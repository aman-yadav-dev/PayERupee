import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/infrastructure/database/db';
import { WithdrawalService, DuplicateWithdrawalError, InvalidStateError } from '@/modules/wallet/application/withdrawal.service';
import { Prisma, LedgerAccountType, Currency } from '@prisma/client';

describe('WithdrawalService Integration Tests', () => {
  let merchantUserId: string;
  let adminUserId: string;
  let merchantProfileId: string;
  let walletId: string;
  let merchantLedgerId: string;
  let merchantBankId: string;

  beforeAll(async () => {
    // Setup Transit Account
    const transit = await db.ledgerAccount.findFirst({ where: { type: LedgerAccountType.SYSTEM_TRANSIT } });
    if (!transit) {
      await db.ledgerAccount.create({
        data: {
          type: LedgerAccountType.SYSTEM_TRANSIT,
          currency: Currency.INR,
          isActive: true
        }
      });
    }

    // Create Admin
    const admin = await db.user.create({
      data: {
        email: `admin_${Date.now()}@test.com`,
        name: 'Admin',
        role: 'ADMIN'
      }
    });
    adminUserId = admin.id;

    // Create Merchant
    const merchant = await db.user.create({
      data: {
        email: `merchant_${Date.now()}@test.com`,
        name: 'Merchant',
        role: 'MERCHANT'
      }
    });
    merchantUserId = merchant.id;

    // Create Merchant Profile
    const profile = await db.merchantProfile.create({
      data: {
        userId: merchantUserId,
        businessName: 'Test Business'
      }
    });
    merchantProfileId = profile.id;

    // Create Merchant Ledger
    const ledger = await db.ledgerAccount.create({
      data: {
        merchantProfileId,
        type: LedgerAccountType.MERCHANT_LIABILITY,
        currency: Currency.INR,
        isActive: true
      }
    });
    merchantLedgerId = ledger.id;

    // Create Wallet
    const wallet = await db.wallet.create({
      data: {
        merchantProfileId,
        ledgerAccountId: merchantLedgerId,
        balance: 1000,
        currency: Currency.INR
      }
    });
    walletId = wallet.id;

    // Create System Settings
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: { minWithdrawAmount: new Prisma.Decimal(50), upiPayoutFee: new Prisma.Decimal(10), taxPercentage: new Prisma.Decimal(18) },
      create: { id: "GLOBAL_SETTINGS", minWithdrawAmount: new Prisma.Decimal(50), upiPayoutFee: new Prisma.Decimal(10), taxPercentage: new Prisma.Decimal(18) }
    });

    // Create Merchant Bank
    const bank = await db.merchantBank.create({
      data: {
        merchantProfileId,
        accountNumber: '1234567890',
        ifscCode: 'TEST0001234',
        accountHolderName: 'Test Name',
        isVerified: true,
        isActive: true
      }
    });
    merchantBankId = bank.id;
  });

  it('should successfully create a pending withdrawal request and debit wallet (above minimum)', async () => {
    const withdrawal = await WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(100),
      idempotencyKey: 'TEST_IDEMP_1'
    });

    expect(withdrawal.status).toBe('PENDING');
    expect(withdrawal.amount.toNumber()).toBe(100);

    // Verify 0 fee and tax logic explicitly (totalDebitAmount = amount)
    expect(withdrawal.fee.toNumber()).toBe(0);
    expect(withdrawal.totalDebitAmount.toNumber()).toBe(100);

    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBe(900); // 1000 - 100
  });

  it('should successfully create a withdrawal request (exactly minimum)', async () => {
    const withdrawal = await WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'TEST_IDEMP_MIN_EXACT'
    });
    expect(withdrawal.status).toBe('PENDING');
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBe(850); // 900 - 50
  });

  it('should reject a withdrawal request (below minimum)', async () => {
    await expect(WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(49),
      idempotencyKey: 'TEST_IDEMP_MIN_BELOW'
    })).rejects.toThrow('Minimum withdrawal amount is 50');
  });

  it('should throw InsufficientFundsError when amount exceeds balance', async () => {
    await expect(WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(1000), // Only 900 left
      idempotencyKey: 'TEST_IDEMP_2'
    })).rejects.toThrow('Insufficient wallet balance.');
  });

  it('should throw DuplicateWithdrawalError on duplicate idempotencyKey', async () => {
    await expect(WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'TEST_IDEMP_1'
    })).rejects.toThrow(DuplicateWithdrawalError);
  });

  it('should approve a pending withdrawal', async () => {
    const withdrawal = await WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'TEST_IDEMP_3'
    });

    const approved = await WithdrawalService.approveWithdrawal(withdrawal.id, adminUserId);
    expect(approved.status).toBe('SUCCESS');

    // Balance remains 800 (850 - 50)
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBe(800);
  });

  it('should prevent double approval', async () => {
    const withdrawal = await WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'TEST_IDEMP_4'
    });

    await WithdrawalService.approveWithdrawal(withdrawal.id, adminUserId);

    await expect(WithdrawalService.approveWithdrawal(withdrawal.id, adminUserId))
      .rejects.toThrow(InvalidStateError);
  });

  it('should reject a pending withdrawal and refund the wallet', async () => {
    const withdrawal = await WithdrawalService.createWithdrawal(merchantProfileId, {
      merchantBankId,
      amount: new Prisma.Decimal(50),
      idempotencyKey: 'TEST_IDEMP_5'
    });

    // Wallet is now 700 (750 - 50 = 700)
    let wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBe(700);

    const rejected = await WithdrawalService.rejectWithdrawal(withdrawal.id, adminUserId, 'Test reject');
    expect(rejected.status).toBe('FAILED');
    expect(rejected.failureReason).toBe('Test reject');

    // Wallet refunded back to 750
    wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBe(750);
  });
});
