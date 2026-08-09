import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { adjustWalletBalance, OptimisticLockError } from "@/lib/services/wallet.service";
import { Prisma, Currency, LedgerAccountType } from "@prisma/client";
const Decimal = Prisma.Decimal;

describe("Wallet Service Concurrency (Integration)", () => {
  let testWalletId: string;

  beforeAll(async () => {
    // 1. Create a dummy user and merchant profile
    const dummyUser = await db.user.create({
      data: {
        email: `concurrency-test-${Date.now()}@example.com`,
        name: "Test User",
      },
    });

    const merchantProfile = await db.merchantProfile.create({
      data: {
        userId: dummyUser.id,
      },
    });

    const liabilityAccount = await db.ledgerAccount.create({
      data: {
        merchantProfileId: merchantProfile.id,
        type: LedgerAccountType.MERCHANT_LIABILITY,
        currency: Currency.INR,
      },
    });

    const wallet = await db.wallet.create({
      data: {
        merchantProfileId: merchantProfile.id,
        ledgerAccountId: liabilityAccount.id,
        currency: Currency.INR,
        balance: 1000.0,
      },
    });

    testWalletId = wallet.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("should successfully adjust balance sequentially", async () => {
    const wallet = await db.wallet.findUniqueOrThrow({ where: { id: testWalletId } });
    
    const updated = await adjustWalletBalance(
      wallet.id,
      wallet.merchantProfileId,
      new Decimal("-100"),
      wallet.version
    );

    expect(updated.balance.toString()).toBe("900");
    expect(updated.version).toBe(wallet.version + 1);
  });

  it("should throw OptimisticLockError when parallel adjustments race for the same version", async () => {
    // 1. Fetch the exact same version twice
    const wallet = await db.wallet.findUniqueOrThrow({ where: { id: testWalletId } });
    const initialVersion = wallet.version;

    // 2. First adjustment succeeds
    const firstAdjustment = await adjustWalletBalance(
      wallet.id,
      wallet.merchantProfileId,
      new Decimal("-50"),
      initialVersion
    );
    expect(firstAdjustment.version).toBe(initialVersion + 1);

    // 3. Second adjustment using the STALE initial version MUST fail
    await expect(
      adjustWalletBalance(
        wallet.id,
        wallet.merchantProfileId,
        new Decimal("-50"),
        initialVersion
      )
    ).rejects.toThrow(OptimisticLockError);
  });
});

import { reconcileWalletBalance, ReconciliationError } from "@/lib/services/wallet.service";
import { createLedgerEntry } from "@/lib/services/ledger.service";
import { LedgerEntryPurpose, ReferenceType } from "@prisma/client";

describe("Wallet/Ledger Reconciliation (Integration)", () => {
  let testWalletId: string;
  let testMerchantId: string;

  beforeAll(async () => {
    const dummyUser = await db.user.create({
      data: { email: `recon-test-${Date.now()}@example.com`, name: "Recon User" },
    });

    const merchantProfile = await db.merchantProfile.create({
      data: { userId: dummyUser.id },
    });
    testMerchantId = merchantProfile.id;

    const liabilityAccount = await db.ledgerAccount.create({
      data: {
        merchantProfileId: testMerchantId,
        type: LedgerAccountType.MERCHANT_LIABILITY,
        currency: Currency.INR,
      },
    });

    const transit = await db.ledgerAccount.findFirst({
      where: { type: LedgerAccountType.SYSTEM_TRANSIT },
    });
    if (!transit) throw new Error("Missing transit account");

    // Seed Ledger Entries (Total Credit: 1500, Total Debit: 500 => Expected Balance: 1000)
    await createLedgerEntry({
      amount: "1500.0",
      creditAccountId: liabilityAccount.id,
      debitAccountId: transit.id,
      purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
      referenceType: ReferenceType.SYSTEM,
      description: "Initial Credit",
    });

    await createLedgerEntry({
      amount: "500.0",
      creditAccountId: transit.id,
      debitAccountId: liabilityAccount.id,
      purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
      referenceType: ReferenceType.SYSTEM,
      description: "Initial Debit",
    });

    // Create wallet with perfectly matching balance
    const wallet = await db.wallet.create({
      data: {
        merchantProfileId: testMerchantId,
        ledgerAccountId: liabilityAccount.id,
        currency: Currency.INR,
        balance: 1000.0,
      },
    });
    testWalletId = wallet.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("should succeed reconciliation when Wallet.balance exactly matches Ledger (Credits - Debits)", async () => {
    const { expectedBalance, wallet } = await reconcileWalletBalance(testWalletId, testMerchantId);
    expect(wallet.balance.toString()).toBe("1000");
    expect(expectedBalance.toString()).toBe("1000");
  });

  it("should throw ReconciliationError when Wallet.balance deviates from Ledger history", async () => {
    // Intentionally corrupt the materialized balance directly in DB
    const wallet = await db.wallet.findUniqueOrThrow({ where: { id: testWalletId } });
    await db.wallet.update({
      where: { id: testWalletId },
      data: { balance: new Decimal("999.0"), version: { increment: 1 } },
    });

    await expect(
      reconcileWalletBalance(testWalletId, testMerchantId)
    ).rejects.toThrow(ReconciliationError);

    // Restore it
    await db.wallet.update({
      where: { id: testWalletId },
      data: { balance: new Decimal("1000.0"), version: { increment: 1 } },
    });
  });

  it("should throw Error when attempting to reconcile with mismatched merchantProfileId", async () => {
    await expect(
      reconcileWalletBalance(testWalletId, "fake-merchant-id")
    ).rejects.toThrow("Wallet not found or belongs to a different merchant.");
  });
});
