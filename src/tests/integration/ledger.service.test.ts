import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createLedgerEntry, InvalidLedgerEntryError } from "@/lib/services/ledger.service";
import { LedgerAccountType, Currency, LedgerEntryPurpose, ReferenceType } from "@prisma/client";

describe("Ledger Service Invariants (Integration)", () => {
  let transitAccountId: string;
  let revenueAccountId: string;

  beforeAll(async () => {
    // Rely on the Phase 1 seed
    const transit = await db.ledgerAccount.findFirst({
      where: { type: LedgerAccountType.SYSTEM_TRANSIT },
    });
    const revenue = await db.ledgerAccount.findFirst({
      where: { type: LedgerAccountType.SYSTEM_REVENUE },
    });

    if (!transit || !revenue) throw new Error("Missing seeded system accounts");
    transitAccountId = transit.id;
    revenueAccountId = revenue.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("should successfully create a valid ledger entry", async () => {
    const entry = await createLedgerEntry({
      amount: "100.50",
      debitAccountId: transitAccountId,
      creditAccountId: revenueAccountId,
      purpose: LedgerEntryPurpose.FEE_AND_TAX,
      referenceType: ReferenceType.SYSTEM,
      description: "Test Entry",
    });

    expect(entry).toBeDefined();
    expect(entry.amount.toString()).toBe("100.5");
    expect(entry.debitAccountId).toBe(transitAccountId);
    expect(entry.creditAccountId).toBe(revenueAccountId);
  });

  it("should throw InvalidLedgerEntryError when debit and credit accounts are identical", async () => {
    await expect(
      createLedgerEntry({
        amount: "50",
        debitAccountId: transitAccountId,
        creditAccountId: transitAccountId, // Same account!
        purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
        referenceType: ReferenceType.SYSTEM,
        description: "Invalid self-transfer",
      })
    ).rejects.toThrow(InvalidLedgerEntryError);
  });

  it("should throw an error when amount is zero or negative", async () => {
    await expect(
      createLedgerEntry({
        amount: "0",
        debitAccountId: transitAccountId,
        creditAccountId: revenueAccountId,
        purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
        referenceType: ReferenceType.SYSTEM,
        description: "Zero amount",
      })
    ).rejects.toThrow();

    await expect(
      createLedgerEntry({
        amount: "-10",
        debitAccountId: transitAccountId,
        creditAccountId: revenueAccountId,
        purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
        referenceType: ReferenceType.SYSTEM,
        description: "Negative amount",
      })
    ).rejects.toThrow();
  });
});
