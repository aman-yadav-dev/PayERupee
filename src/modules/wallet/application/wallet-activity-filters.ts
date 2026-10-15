
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export class InvalidFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFilterError";
  }
}

export function parseWalletFilters(req: NextRequest, merchantProfileId: string) {
  const searchParams = req.nextUrl.searchParams;

  const statusParam = searchParams.get("status");
  const minAmountStr = searchParams.get("minAmount");
  const maxAmountStr = searchParams.get("maxAmount");
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const search = searchParams.get("search")?.trim().toLowerCase();
  const typeParam = searchParams.get("type"); // "ADD_MONEY", "WITHDRAWAL", or null

  let queryFundRequests = true;
  let queryWithdrawals = true;

  if (typeParam === "ADD_MONEY") {
    queryWithdrawals = false;
  } else if (typeParam === "WITHDRAWAL") {
    queryFundRequests = false;
  }

  const fundRequestsWhere: Prisma.FundRequestWhereInput = { merchantProfileId };
  const withdrawalsWhere: Prisma.WithdrawalWhereInput = { merchantProfileId };

  if (startDateStr || endDateStr) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (startDateStr) {
      const d = new Date(startDateStr);
      if (isNaN(d.getTime())) throw new InvalidFilterError("Invalid startDate");
      createdAtFilter.gte = d;
    }
    if (endDateStr) {
      const d = new Date(endDateStr);
      if (isNaN(d.getTime())) throw new InvalidFilterError("Invalid endDate");
      createdAtFilter.lte = d;
    }
    if (queryFundRequests) fundRequestsWhere.createdAt = createdAtFilter;
    if (queryWithdrawals) withdrawalsWhere.createdAt = createdAtFilter;
  }

  if (statusParam && statusParam !== "All statuses") {
    const upStatus = statusParam.toUpperCase();
    
    if (upStatus === "PENDING") {
      if (queryFundRequests) fundRequestsWhere.status = "PENDING";
      if (queryWithdrawals) withdrawalsWhere.status = "PENDING";
    } else if (upStatus === "COMPLETED" || upStatus === "SUCCESS") {
      if (queryFundRequests) fundRequestsWhere.status = "APPROVED";
      if (queryWithdrawals) withdrawalsWhere.status = "SUCCESS";
    } else if (upStatus === "FAILED" || upStatus === "REJECTED") {
      if (queryFundRequests) fundRequestsWhere.status = "REJECTED";
      if (queryWithdrawals) withdrawalsWhere.status = "FAILED";
    } else {
      // Unrecognized status should just result in no matches, or error out?
      // "Do not add arbitrary sentinel values... Build valid model-specific status values"
      // If the UI sends something wild, we can just throw to prevent Prisma 500s.
      throw new InvalidFilterError("Unknown status filter");
    }
  }

  if (minAmountStr || maxAmountStr) {
    const amountFilter: Prisma.DecimalFilter = {};
    let min: Prisma.Decimal | undefined;
    let max: Prisma.Decimal | undefined;

    if (minAmountStr) {
      try { min = new Prisma.Decimal(minAmountStr); } catch { throw new InvalidFilterError("Invalid minAmount"); }
      amountFilter.gte = min;
    }
    if (maxAmountStr) {
      try { max = new Prisma.Decimal(maxAmountStr); } catch { throw new InvalidFilterError("Invalid maxAmount"); }
      amountFilter.lte = max;
    }

    if (min && max && min.greaterThan(max)) {
      throw new InvalidFilterError("minAmount cannot be greater than maxAmount");
    }

    if (queryFundRequests) fundRequestsWhere.amount = amountFilter;
    if (queryWithdrawals) withdrawalsWhere.amount = amountFilter;
  }

  if (search) {
    if (queryFundRequests) {
      fundRequestsWhere.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { utrNumber: { contains: search, mode: "insensitive" } }
      ];
    }
    if (queryWithdrawals) {
      withdrawalsWhere.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { bankReference: { contains: search, mode: "insensitive" } },
        { providerReference: { contains: search, mode: "insensitive" } }
      ];
    }
  }

  return { queryFundRequests, queryWithdrawals, fundRequestsWhere, withdrawalsWhere };
}

