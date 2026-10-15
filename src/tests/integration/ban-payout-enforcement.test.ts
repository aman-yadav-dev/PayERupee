import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/infrastructure/database/db";
import {
  Prisma,
  LedgerAccountType,
  PaymentMode,
  LedgerEntryPurpose,
  ReferenceType,
  UserRole,
} from "@prisma/client";
import { onboardMerchant } from "@/modules/merchant/domain/merchant.service";
import {
  createPayout,
  DestinationBannedError,
} from "@/modules/payout/domain/payout.service";
import { WithdrawalService } from "@/modules/wallet/application/withdrawal.service";
import {
  BanService,
  SanitizedGlobalBan,
  SanitizedMerchantBan,
} from "@/modules/ban/domain/ban.service";
import { AuthenticatedMerchantContext } from "@/modules/auth/application/session-auth.service";
import crypto from "crypto";

const uuidv4 = () => crypto.randomUUID();

describe("Ban Payout Enforcement Integration Test", () => {
  let adminUserId: string;

  let merchant1ProfileId: string;
  let merchant1WalletId: string;
  let actor1: AuthenticatedMerchantContext;

  let merchant2ProfileId: string;
  let merchant2WalletId: string;
  let actor2: AuthenticatedMerchantContext;

  let globalBanForUpi: SanitizedGlobalBan;
  let merchant1BankBan: SanitizedMerchantBan;

  beforeAll(async () => {
    // 1. Ensure system settings exist
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: {
        minPayoutAmount: 1,
        maxPayoutAmount: 10000000,
        minWithdrawAmount: 500,
        taxPercentage: 18,
      },
      create: {
        id: "GLOBAL_SETTINGS",
        upiPayoutFee: new Prisma.Decimal(0),
        impsPayoutFee: new Prisma.Decimal(5),
        neftPayoutFee: new Prisma.Decimal(3),
        rtgsPayoutFee: new Prisma.Decimal(10),
        taxPercentage: new Prisma.Decimal(18),
        minPayoutAmount: 1,
        maxPayoutAmount: 10000000,
        minWithdrawAmount: 500,
      },
    });

    // 2. Ensure active fee rules exist for UPI and IMPS
    const upiRule = await db.payoutFeeRule.findFirst({
      where: { paymentMode: PaymentMode.UPI, isActive: true },
    });
    if (!upiRule) {
      await db.payoutFeeRule.create({
        data: {
          paymentMode: PaymentMode.UPI,
          minAmount: 1,
          maxAmount: 10000000,
          fee: 2.5,
          isActive: true,
        },
      });
    }

    const impsRule = await db.payoutFeeRule.findFirst({
      where: { paymentMode: PaymentMode.IMPS, isActive: true },
    });
    if (!impsRule) {
      await db.payoutFeeRule.create({
        data: {
          paymentMode: PaymentMode.IMPS,
          minAmount: 1,
          maxAmount: 10000000,
          fee: 6.0,
          isActive: true,
        },
      });
    }

    // 3. Create Admin user
    const adminUser = await db.user.create({
      data: {
        email: `admin-ban-${Date.now()}@example.com`,
        name: "Admin Ban Authority",
        role: UserRole.ADMIN,
      },
    });
    adminUserId = adminUser.id;

    // 4. Create and onboard Merchant 1
    const user1 = await db.user.create({
      data: {
        email: `merchant1-ban-${Date.now()}@example.com`,
        name: "Merchant 1 Tester",
      },
    });
    const m1 = await onboardMerchant({
      userId: user1.id,
      businessName: "Merchant 1 Enterprises",
    });
    merchant1ProfileId = m1.merchantProfile.id;
    merchant1WalletId = m1.wallet.id;
    actor1 = {
      userId: user1.id,
      merchantProfileId: m1.merchantProfile.id,
    };

    // 5. Create and onboard Merchant 2
    const user2 = await db.user.create({
      data: {
        email: `merchant2-ban-${Date.now()}@example.com`,
        name: "Merchant 2 Tester",
      },
    });
    const m2 = await onboardMerchant({
      userId: user2.id,
      businessName: "Merchant 2 Logistics",
    });
    merchant2ProfileId = m2.merchantProfile.id;
    merchant2WalletId = m2.wallet.id;
    actor2 = {
      userId: user2.id,
      merchantProfileId: m2.merchantProfile.id,
    };

    // 6. Seed funds into both merchants' wallets
    const transit = await db.ledgerAccount.findFirst({
      where: { type: LedgerAccountType.SYSTEM_TRANSIT },
    });
    const { createLedgerEntry } = await import("@/modules/ledger/domain/ledger.service");

    await createLedgerEntry({
      amount: "100000.0",
      creditAccountId: m1.liabilityAccount.id,
      debitAccountId: transit!.id,
      purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
      referenceType: ReferenceType.SYSTEM,
      description: "Seed Funds M1",
    });
    await db.wallet.update({
      where: { id: m1.wallet.id },
      data: { balance: 100000.0, version: { increment: 1 } },
    });

    await createLedgerEntry({
      amount: "100000.0",
      creditAccountId: m2.liabilityAccount.id,
      debitAccountId: transit!.id,
      purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
      referenceType: ReferenceType.SYSTEM,
      description: "Seed Funds M2",
    });
    await db.wallet.update({
      where: { id: m2.wallet.id },
      data: { balance: 100000.0, version: { increment: 1 } },
    });
  });

  it("1. Global Ban Blocks Payout across all merchants without debiting wallet or writing ledger entries", async () => {
    // 1a. Create and approve a global ban on destination UPI:fraud_global@upi
    const { request } = await BanService.createGlobalBanRequest(actor1, {
      destination: { type: "UPI", vpa: "fraud_global@upi" },
      reason: "Confirmed platform-wide fraud syndicate",
      applyImmediateLocalBan: false, // ensures only global ban applies
    });

    globalBanForUpi = await BanService.approveGlobalBanRequest(
      adminUserId,
      request.id,
      "Approved syndicate global ban"
    );
    expect(globalBanForUpi.status).toBe("ACTIVE");

    // Capture state before payout attempts
    const w1Before = await db.wallet.findUniqueOrThrow({ where: { id: merchant1WalletId } });
    const w2Before = await db.wallet.findUniqueOrThrow({ where: { id: merchant2WalletId } });
    const ledgerCountBefore = await db.ledgerEntry.count();
    const payoutsCountBefore = await db.payout.count();

    // 1b. Attempt createPayout from Merchant 1 to fraud_global@upi
    let caughtM1Error: any;
    try {
      await createPayout(merchant1ProfileId, "LIVE", uuidv4(), {
        amount: "100.0",
        paymentMode: PaymentMode.UPI,
        vpa: "fraud_global@upi",
        beneficiaryPhone: "+919876543210",
      });
    } catch (err) {
      caughtM1Error = err;
    }
    expect(caughtM1Error).toBeInstanceOf(DestinationBannedError);
    expect(caughtM1Error.banScope).toBe("GLOBAL");

    // 1c. Attempt createPayout from Merchant 2 to fraud_global@upi
    let caughtM2Error: any;
    try {
      await createPayout(merchant2ProfileId, "LIVE", uuidv4(), {
        amount: "100.0",
        paymentMode: PaymentMode.UPI,
        vpa: "fraud_global@upi",
        beneficiaryPhone: "+919876543210",
      });
    } catch (err) {
      caughtM2Error = err;
    }
    expect(caughtM2Error).toBeInstanceOf(DestinationBannedError);
    expect(caughtM2Error.banScope).toBe("GLOBAL");

    // 1d. Verify wallet balance was NOT debited and zero ledger entries were written
    const w1After = await db.wallet.findUniqueOrThrow({ where: { id: merchant1WalletId } });
    const w2After = await db.wallet.findUniqueOrThrow({ where: { id: merchant2WalletId } });
    const ledgerCountAfter = await db.ledgerEntry.count();
    const payoutsCountAfter = await db.payout.count();

    expect(w1After.balance.toString()).toBe(w1Before.balance.toString());
    expect(w2After.balance.toString()).toBe(w2Before.balance.toString());
    expect(ledgerCountAfter).toBe(ledgerCountBefore);
    expect(payoutsCountAfter).toBe(payoutsCountBefore);
  });

  it("2. Local Ban Isolation: blocks Merchant 1 while identical destination SUCCEEDS for Merchant 2", async () => {
    // 2a. Create a merchant-local ban on BANK:1122334455:HDFC0001234 for Merchant 1
    merchant1BankBan = await BanService.createMerchantBan(actor1, {
      destination: {
        type: "BANK_ACCOUNT",
        accountNumber: "1122334455",
        ifsc: "HDFC0001234",
      },
      reason: "Merchant 1 internal suspect account",
    });
    expect(merchant1BankBan.status).toBe("ACTIVE");

    // 2b. Attempt createPayout from Merchant 1 with account 1122334455 and IFSC HDFC0001234
    let caughtM1Error: any;
    try {
      await createPayout(merchant1ProfileId, "LIVE", uuidv4(), {
        amount: "100.0",
        paymentMode: PaymentMode.IMPS,
        accountNumber: "1122334455",
        ifscCode: "HDFC0001234",
        accountHolderName: "M1 Blocked Beneficiary",
        beneficiaryPhone: "+919876543210",
      });
    } catch (err) {
      caughtM1Error = err;
    }
    expect(caughtM1Error).toBeInstanceOf(DestinationBannedError);
    expect(caughtM1Error.banScope).toBe("MERCHANT");

    // 2c. Attempt createPayout from Merchant 2 with identical account 1122334455 and IFSC HDFC0001234
    const m2Payout = await createPayout(merchant2ProfileId, "LIVE", uuidv4(), {
      amount: "100.0",
      paymentMode: PaymentMode.IMPS,
      accountNumber: "1122334455",
      ifscCode: "HDFC0001234",
      accountHolderName: "M2 Allowed Beneficiary",
      beneficiaryPhone: "+919876543210",
    });

    expect(m2Payout.isNew).toBe(true);
    expect(m2Payout.payout.status).toBe("PENDING");
    expect(m2Payout.payout.merchantProfileId).toBe(merchant2ProfileId);
    expect(m2Payout.payout.accountNumber).toBe("1122334455");
    expect(m2Payout.payout.ifscCode).toBe("HDFC0001234");
  });

  it("3. Unban Lifecycle Restores Eligibility for Merchant 1", async () => {
    // 3a. Locate Merchant 1's active ban on 1122334455
    const bans = await BanService.listMerchantBans(actor1);
    const targetBan = bans.find((b) => b.id === merchant1BankBan.id);
    expect(targetBan).toBeDefined();

    // 3b. Unban Merchant 1's ban on 1122334455
    const unbanned = await BanService.unbanMerchantBan(
      actor1,
      merchant1BankBan.id,
      "Customer identity verified by compliance team"
    );
    expect(unbanned.status).toBe("UNBANNED");
    expect(unbanned.unbanReason).toBe("Customer identity verified by compliance team");

    // 3c. Attempt createPayout from Merchant 1 to 1122334455 -> Verify it now SUCCEEDS!
    const m1Payout = await createPayout(merchant1ProfileId, "LIVE", uuidv4(), {
      amount: "100.0",
      paymentMode: PaymentMode.IMPS,
      accountNumber: "1122334455",
      ifscCode: "HDFC0001234",
      accountHolderName: "M1 Re-enabled Beneficiary",
      beneficiaryPhone: "+919876543210",
    });

    expect(m1Payout.isNew).toBe(true);
    expect(m1Payout.payout.status).toBe("PENDING");
    expect(m1Payout.payout.merchantProfileId).toBe(merchant1ProfileId);
    expect(m1Payout.payout.accountNumber).toBe("1122334455");
  });

  it("4. Global Ban Removal Restores Eligibility for Merchant 1", async () => {
    // 4a. Admin removes the global ban on fraud_global@upi with valid removal reason
    const removedBan = await BanService.removeGlobalBan(
      adminUserId,
      globalBanForUpi.id,
      "False positive cleared after thorough banking investigation"
    );
    expect(removedBan.status).toBe("REMOVED");
    expect(removedBan.removalReason).toBe(
      "False positive cleared after thorough banking investigation"
    );

    // 4b. Attempt createPayout from Merchant 1 to fraud_global@upi -> Verify it now SUCCEEDS!
    const m1UpiPayout = await createPayout(merchant1ProfileId, "LIVE", uuidv4(), {
      amount: "100.0",
      paymentMode: PaymentMode.UPI,
      vpa: "fraud_global@upi",
      beneficiaryPhone: "+919876543210",
    });

    expect(m1UpiPayout.isNew).toBe(true);
    expect(m1UpiPayout.payout.status).toBe("PENDING");
    expect(m1UpiPayout.payout.merchantProfileId).toBe(merchant1ProfileId);
    expect(m1UpiPayout.payout.vpa).toBe("fraud_global@upi");
  });

  it("5. Idempotency Invariant Preserved: pre-existing payout returns existing record without error after destination is banned", async () => {
    const idemKey = uuidv4();
    const payoutData = {
      amount: "100.0",
      paymentMode: PaymentMode.UPI,
      vpa: "idempotency_dest@upi",
      beneficiaryPhone: "+919876543210",
    };

    // 5a. Create payout before ban
    const initialPayoutResult = await createPayout(
      merchant1ProfileId,
      "LIVE",
      idemKey,
      payoutData
    );
    expect(initialPayoutResult.isNew).toBe(true);
    expect(initialPayoutResult.payout.id).toBeDefined();

    // 5b. Ban the destination post-creation
    await BanService.createMerchantBan(actor1, {
      destination: { type: "UPI", vpa: "idempotency_dest@upi" },
      reason: "Banned after initial payout was registered",
    });

    // 5c. Re-submitting with the same idempotencyKey returns existing payout without error (isNew === false)
    const replayedResult = await createPayout(
      merchant1ProfileId,
      "LIVE",
      idemKey,
      payoutData
    );
    expect(replayedResult.isNew).toBe(false);
    expect(replayedResult.payout.id).toBe(initialPayoutResult.payout.id);
  });

  it("6. Withdrawal Enforcement: blocks banned merchant bank before wallet balance or ledger is touched", async () => {
    // 6a. Seed a merchant bank for Merchant 1 with account 9988776655 and IFSC ICIC0001234
    const bank = await db.merchantBank.create({
      data: {
        merchantProfileId: merchant1ProfileId,
        accountNumber: "9988776655",
        ifscCode: "ICIC0001234",
        accountHolderName: "Merchant 1 Settlement Account",
        isVerified: true,
        isActive: true,
      },
    });

    // 6b. Ban 9988776655
    await BanService.createMerchantBan(actor1, {
      destination: {
        type: "BANK_ACCOUNT",
        accountNumber: "9988776655",
        ifsc: "ICIC0001234",
      },
      reason: "Compromised settlement bank account",
    });

    // Capture state before withdrawal attempt
    const walletBefore = await db.wallet.findUniqueOrThrow({
      where: { id: merchant1WalletId },
    });
    const ledgerCountBefore = await db.ledgerEntry.count();
    const withdrawalsBefore = await db.withdrawal.count();

    // 6c. Attempt WithdrawalService.createWithdrawal -> Verify it throws DestinationBannedError
    let caughtWithdrawalError: any;
    try {
      await WithdrawalService.createWithdrawal(merchant1ProfileId, {
        amount: new Prisma.Decimal(500),
        merchantBankId: bank.id,
        idempotencyKey: uuidv4(),
      });
    } catch (err) {
      caughtWithdrawalError = err;
    }

    expect(caughtWithdrawalError).toBeInstanceOf(DestinationBannedError);
    expect(caughtWithdrawalError.banScope).toBe("MERCHANT");

    // 6d. Verify wallet balance was NOT adjusted and zero ledger/withdrawal records written
    const walletAfter = await db.wallet.findUniqueOrThrow({
      where: { id: merchant1WalletId },
    });
    const ledgerCountAfter = await db.ledgerEntry.count();
    const withdrawalsAfter = await db.withdrawal.count();

    expect(walletAfter.balance.toString()).toBe(walletBefore.balance.toString());
    expect(ledgerCountAfter).toBe(ledgerCountBefore);
    expect(withdrawalsAfter).toBe(withdrawalsBefore);
  });
});
