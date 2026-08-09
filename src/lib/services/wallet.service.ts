import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
type Decimal = Prisma.Decimal;

export class OptimisticLockError extends Error {
  constructor(message = "Wallet was modified by another transaction. Please retry.") {
    super(message);
    this.name = "OptimisticLockError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(message = "Insufficient wallet balance.") {
    super(message);
    this.name = "InsufficientFundsError";
  }
}

export class ReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconciliationError";
  }
}

/**
 * Adjusts the wallet balance using Optimistic Concurrency Control (OCC) and enforces Merchant ownership.
 * This must be wrapped in the same transaction as the ledger entry.
 */
export async function adjustWalletBalance(
  walletId: string,
  merchantProfileId: string,
  amountDelta: Decimal,
  currentVersion: number,
  tx: Prisma.TransactionClient = db
) {
  try {
    const updatedWallet = await tx.wallet.update({
      where: {
        id: walletId,
        merchantProfileId, // Defense-in-depth: enforces merchant ownership boundary
        version: currentVersion,
      },
      data: {
        balance: {
          increment: amountDelta,
        },
        version: {
          increment: 1,
        },
      },
    });
    
    if (updatedWallet.balance.lt(0)) {
      throw new InsufficientFundsError();
    }
    
    return updatedWallet;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new OptimisticLockError();
    }
    throw error;
  }
}

/**
 * Reconciles the materialized Wallet.balance against the immutable LedgerEntry history.
 * Throws a ReconciliationError if discrepancies are found. It does NOT silently repair.
 */
export async function reconcileWalletBalance(
  walletId: string,
  merchantProfileId: string,
  tx: Prisma.TransactionClient = db
) {
  const wallet = await tx.wallet.findUnique({
    where: { id: walletId, merchantProfileId },
  });

  if (!wallet) {
    throw new Error("Wallet not found or belongs to a different merchant.");
  }

  const ledgerAccountId = wallet.ledgerAccountId;

  const creditsAgg = await tx.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { creditAccountId: ledgerAccountId },
  });

  const debitsAgg = await tx.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { debitAccountId: ledgerAccountId },
  });

  const totalCredits = creditsAgg._sum.amount ?? new Prisma.Decimal(0);
  const totalDebits = debitsAgg._sum.amount ?? new Prisma.Decimal(0);
  
  const expectedBalance = totalCredits.minus(totalDebits);

  if (!wallet.balance.equals(expectedBalance)) {
    throw new ReconciliationError(
      `Wallet balance discrepancy. Expected: ${expectedBalance.toString()}, Actual: ${wallet.balance.toString()}`
    );
  }

  return { wallet, expectedBalance };
}
