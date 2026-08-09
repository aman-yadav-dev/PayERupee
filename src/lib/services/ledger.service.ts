import { Prisma, LedgerEntryPurpose, ReferenceType } from "@prisma/client";
import { db } from "@/lib/db";
import { toDecimal, assertPositive } from "@/lib/utils/decimal";
type Decimal = Prisma.Decimal;

export type CreateLedgerEntryInput = {
  amount: string | number | Decimal;
  debitAccountId: string;
  creditAccountId: string;
  purpose: LedgerEntryPurpose;
  referenceType: ReferenceType;
  referenceId?: string;
  description: string;
  payoutId?: string; // If this entry is tied to a payout
};

export class LedgerImmutabilityError extends Error {
  constructor(message = "Ledger records are immutable.") {
    super(message);
    this.name = "LedgerImmutabilityError";
  }
}

export class InvalidLedgerEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLedgerEntryError";
  }
}

/**
 * Creates a balanced double-entry ledger record.
 * This represents exactly ONE complete double-entry movement containing both
 * debitAccountId and creditAccountId.
 */
export async function createLedgerEntry(
  input: CreateLedgerEntryInput,
  tx: Prisma.TransactionClient = db
) {
  const decimalAmount = toDecimal(input.amount);
  
  // Invariants
  assertPositive(decimalAmount, "LedgerEntry.amount");

  if (input.debitAccountId === input.creditAccountId) {
    throw new InvalidLedgerEntryError("debitAccountId cannot equal creditAccountId.");
  }

  return tx.ledgerEntry.create({
    data: {
      amount: decimalAmount,
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      purpose: input.purpose,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
      payoutId: input.payoutId,
    },
  });
}
