import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

export class InvalidFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFilterError";
  }
}

export function parseTransactionsFilters(req: NextRequest, merchantProfileId: string): Prisma.PayoutWhereInput {
  const url = req.nextUrl;
  
  const statusParam = url.searchParams.get("status");
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");
  const minStr = url.searchParams.get("minAmount");
  const maxStr = url.searchParams.get("maxAmount");
  const searchParam = url.searchParams.get("search");
  const paymentModeParam = url.searchParams.get("paymentMode");

  const whereClause: Prisma.PayoutWhereInput = {
    merchantProfileId
  };

  if (statusParam && statusParam !== "All statuses") {
    const upStatus = statusParam.toUpperCase();
    if (upStatus === "PENDING") {
      whereClause.status = "PENDING";
    } else if (upStatus === "COMPLETED" || upStatus === "SUCCESS") {
      whereClause.status = "SUCCESS";
    } else if (upStatus === "FAILED" || upStatus === "REJECTED") {
      whereClause.status = "FAILED";
    } else {
      throw new InvalidFilterError("Unknown status filter");
    }
  }

  if (startDateParam || endDateParam) {
    whereClause.createdAt = {};
    if (startDateParam) {
      const d = new Date(startDateParam);
      if (isNaN(d.getTime())) throw new InvalidFilterError("Invalid startDate");
      whereClause.createdAt.gte = d;
    }
    if (endDateParam) {
      const d = new Date(endDateParam);
      if (isNaN(d.getTime())) throw new InvalidFilterError("Invalid endDate");
      whereClause.createdAt.lte = d;
    }
  }

  if (minStr !== null || maxStr !== null) {
    const amountFilter: Prisma.DecimalFilter = {};
    let min: Prisma.Decimal | undefined;
    let max: Prisma.Decimal | undefined;

    if (minStr) {
      try { min = new Prisma.Decimal(minStr); } catch { throw new InvalidFilterError("Invalid minAmount"); }
      amountFilter.gte = min;
    }
    if (maxStr) {
      try { max = new Prisma.Decimal(maxStr); } catch { throw new InvalidFilterError("Invalid maxAmount"); }
      amountFilter.lte = max;
    }

    if (min && max && min.greaterThan(max)) {
      throw new InvalidFilterError("minAmount cannot be greater than maxAmount");
    }

    if (Object.keys(amountFilter).length > 0) {
      whereClause.amount = amountFilter;
    }
  }

  if (paymentModeParam && paymentModeParam !== "All modes") {
    const upMode = paymentModeParam.toUpperCase();
    if (["UPI", "IMPS", "NEFT", "RTGS", "WALLET", "CARD"].includes(upMode)) {
      whereClause.paymentMode = upMode as any;
    } else {
      throw new InvalidFilterError("Unknown payment mode filter");
    }
  }

  if (searchParam) {
    const search = searchParam.trim();
    if (search) {
      whereClause.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { accountHolderName: { contains: search, mode: "insensitive" } },
        { merchantReference: { contains: search, mode: "insensitive" } },
        { accountNumber: { contains: search, mode: "insensitive" } },
        { providerReference: { contains: search, mode: "insensitive" } },
        { idempotencyKey: { contains: search, mode: "insensitive" } }
      ];
    }
  }

  return whereClause;
}
