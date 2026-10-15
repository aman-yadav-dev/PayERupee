import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context securely on the server
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    // Filter Parsing
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const statusParam = searchParams.get("status");
    const minAmount = searchParams.get("minAmount");
    const maxAmount = searchParams.get("maxAmount");

    const filteredWhere: any = { merchantProfileId };
    if (startDate || endDate) {
      filteredWhere.createdAt = {};
      if (startDate) filteredWhere.createdAt.gte = new Date(startDate);
      if (endDate) filteredWhere.createdAt.lte = new Date(endDate);
    }
    if (statusParam && ['PENDING','PROCESSING','SUCCESS','FAILED','REVERSED'].includes(statusParam)) {
      filteredWhere.status = statusParam;
    }
    if (minAmount || maxAmount) {
      filteredWhere.amount = {};
      if (minAmount && isFinite(Number(minAmount))) filteredWhere.amount.gte = Number(minAmount);
      if (maxAmount && isFinite(Number(maxAmount))) filteredWhere.amount.lte = Number(maxAmount);
    }

    // 2. Fetch scoped wallet
    const wallet = await db.wallet.findUnique({
      where: { merchantProfileId },
      select: {
        id: true,
        currency: true,
        balance: true,
        isActive: true,
        updatedAt: true,
      }
    });

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "Wallet not found" },
        { status: 404 }
      );
    }

    // 3. Calculate this month's and previous month's spend
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const failureCreatedAt: any = { gte: thirtyDaysAgo };
    if (startDate) {
      const parsedStart = new Date(startDate);
      failureCreatedAt.gte = parsedStart > thirtyDaysAgo ? parsedStart : thirtyDaysAgo;
    }
    if (endDate) {
      failureCreatedAt.lte = new Date(endDate);
    }

    const [monthStats, prevMonthStats, filteredStats, failureStats, trendRecords] = await Promise.all([
      db.payout.groupBy({
        by: ['status'],
        _count: true,
        _sum: { totalDebitAmount: true },
        where: { merchantProfileId, createdAt: { gte: startOfMonth } }
      }),
      db.payout.groupBy({
        by: ['status'],
        _count: true,
        _sum: { totalDebitAmount: true },
        where: { merchantProfileId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } }
      }),
      db.payout.groupBy({
        by: ['status'],
        _count: true,
        _sum: { totalDebitAmount: true, amount: true },
        where: filteredWhere
      }),
      db.payout.groupBy({
        by: ['failureReason'],
        _count: true,
        where: { 
          ...filteredWhere, 
          status: 'FAILED', 
          createdAt: failureCreatedAt 
        }
      }),
      db.payout.findMany({
        where: filteredWhere,
        select: { createdAt: true, status: true, amount: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    let monthSpend = 0;
    let previousMonthSpend = 0;

    let currentSuccessCount = 0;
    let currentResolvedCount = 0;
    let prevSuccessCount = 0;
    let prevResolvedCount = 0;

    let pendingCount = 0;
    let pendingAmount = 0;
    let totalMonthCount = 0;

    const statusCounts = {
      SUCCESS: 0,
      PENDING: 0,
      PROCESSING: 0,
      FAILED: 0,
      REVERSED: 0
    };

    // 1. Calculate strictly unfiltered month spend
    for (const stat of monthStats) {
      const status = stat.status;
      const debit = stat._sum.totalDebitAmount?.toNumber() || 0;
      if (status === 'PENDING' || status === 'PROCESSING' || status === 'SUCCESS') {
        monthSpend += debit;
      }
    }

    for (const stat of prevMonthStats) {
      const status = stat.status;
      const count = stat._count;
      const debit = stat._sum.totalDebitAmount?.toNumber() || 0;
      if (status === 'PENDING' || status === 'PROCESSING' || status === 'SUCCESS') {
        previousMonthSpend += debit;
      }
      if (status === 'SUCCESS' || status === 'FAILED' || status === 'REVERSED') {
        prevResolvedCount += count;
        if (status === 'SUCCESS') prevSuccessCount += count;
      }
    }

    // 2. Calculate KPIs based on active filters
    for (const stat of filteredStats) {
      const status = stat.status;
      const count = stat._count;
      const amount = stat._sum.amount?.toNumber() || 0;
      
      statusCounts[status] += count;
      totalMonthCount += count;

      if (status === 'PENDING') {
        pendingCount += count;
        pendingAmount += amount;
      }
      if (status === 'SUCCESS' || status === 'FAILED' || status === 'REVERSED') {
        currentResolvedCount += count;
        if (status === 'SUCCESS') currentSuccessCount += count;
      }
    }

    let monthSpendDelta = 0;
    if (previousMonthSpend > 0) {
      monthSpendDelta = ((monthSpend - previousMonthSpend) / previousMonthSpend) * 100;
    }

    const isFiltered = !!(startDate || endDate || statusParam || minAmount || maxAmount);
    const successRate = currentResolvedCount > 0 ? (currentSuccessCount / currentResolvedCount) * 100 : 0;
    const prevSuccessRate = prevResolvedCount > 0 ? (prevSuccessCount / prevResolvedCount) * 100 : 0;
    const successRateDelta = isFiltered ? null : (successRate - prevSuccessRate);

    // 3. Common Errors
    const failureReasons = failureStats
      .filter(f => f.failureReason)
      .map(f => ({
        code: f.failureReason,
        message: f.failureReason,
        occurrences: f._count
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);

    const totalFailures = failureStats.reduce((sum, f) => sum + f._count, 0);
    const commonErrors = failureReasons.map(f => ({
      ...f,
      percentage: totalFailures > 0 ? Math.round((f.occurrences / totalFailures) * 100) : 0
    }));

    // 4. Trend Data & Hourly Distribution
    const trendMap = new Map<string, { total: number; successful: number; amount: number }>();
    
    // Initialize 24 hourly buckets
    const hourlyBuckets = new Array(24).fill(0).map((_, hour) => ({
      hour: hour.toString().padStart(2, '0') + ':00',
      volume: 0
    }));

    for (const record of trendRecords) {
      // Daily Trend
      const dayStr = record.createdAt.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
      if (!trendMap.has(dayStr)) {
        trendMap.set(dayStr, { total: 0, successful: 0, amount: 0 });
      }
      const bucket = trendMap.get(dayStr)!;
      bucket.total += 1;
      
      // Hourly Distribution
      const hour = record.createdAt.getHours();
      hourlyBuckets[hour].volume += 1;

      if (record.status === 'SUCCESS') {
        bucket.successful += 1;
        bucket.amount += Number(record.amount);
      }
    }
    const trendData = Array.from(trendMap.entries()).map(([date, data]) => ({ date, ...data }));
    const hourlyData = hourlyBuckets;

    return NextResponse.json({
      success: true,
      data: {
        ...wallet,
        monthSpend,
        monthSpendDelta,
        successRate: Math.round(successRate * 10) / 10,
        successRateDelta: successRateDelta !== null ? Math.round(successRateDelta * 10) / 10 : null,
        successCount: currentSuccessCount,
        resolvedCount: currentResolvedCount,
        pendingCount,
        pendingAmount,
        totalMonthCount,
        statusCounts,
        commonErrors,
        trendData,
        hourlyData
      }
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      const fbErr = error as any;
      return NextResponse.json({
        success: false,
        error: {
          code: fbErr.code || "FORBIDDEN",
          message: fbErr.message,
          details: fbErr.details,
          action: fbErr.action
        }
      }, { status: 403 });
    }
    logger.error("[GET /api/v1/merchant/wallet]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
