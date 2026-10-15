import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/infrastructure/database/db';
import { FundRequestService, DuplicateUtrError, InvalidStateError } from '@/modules/wallet/application/fund-request.service';
import { Prisma, LedgerAccountType, Currency } from '@prisma/client';

describe('FundRequestService Integration Tests', () => {
  let merchantUserId: string;
  let adminUserId: string;
  let merchantProfileId: string;
  let walletId: string;
  let merchantLedgerId: string;

  beforeAll(async () => {
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

    const admin = await db.user.create({
      data: {
        email: `admin_${Date.now()}@test.com`,
        name: 'Admin',
        role: 'ADMIN'
      }
    });
    adminUserId = admin.id;

    const merchant = await db.user.create({
      data: {
        email: `merchant_${Date.now()}@test.com`,
        name: 'Merchant',
        role: 'MERCHANT'
      }
    });
    merchantUserId = merchant.id;

    const profile = await db.merchantProfile.create({
      data: {
        userId: merchantUserId,
        businessName: 'Test Business'
      }
    });
    merchantProfileId = profile.id;

    const ledger = await db.ledgerAccount.create({
      data: {
        merchantProfileId,
        type: LedgerAccountType.MERCHANT_LIABILITY,
        currency: Currency.INR,
        isActive: true
      }
    });
    merchantLedgerId = ledger.id;

    // Create System Settings
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: { minAddFundsAmount: new Prisma.Decimal(100) },
      create: { id: "GLOBAL_SETTINGS", minAddFundsAmount: new Prisma.Decimal(100) }
    });

    const wallet = await db.wallet.create({
      data: {
        merchantProfileId,
        ledgerAccountId: merchantLedgerId,
        balance: 0,
        currency: Currency.INR
      }
    });
    walletId = wallet.id;
  });

  it('should successfully create a pending fund request (above minimum)', async () => {
    const utr = `UTR${Date.now()}`;
    const req = await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(500),
      utrNumber: utr,
      paymentMode: 'UPI'
    });
    expect(req.status).toBe('PENDING');
    expect(req.amount.toNumber()).toBe(500);
    expect(req.utrNumber).toBe(utr);
  });

  it('should successfully create a pending fund request (exactly minimum)', async () => {
    const utr = `UTR_EXACT_${Date.now()}`;
    const req = await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(100),
      utrNumber: utr,
      paymentMode: 'UPI'
    });
    expect(req.status).toBe('PENDING');
    expect(req.amount.toNumber()).toBe(100);
  });

  it('should reject a fund request (below minimum)', async () => {
    const utr = `UTR_BELOW_${Date.now()}`;
    await expect(FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(99),
      utrNumber: utr,
      paymentMode: 'UPI'
    })).rejects.toThrow('Minimum add funds amount is 100');
  });

  it('should throw DuplicateUtrError when duplicate UTR is used', async () => {
    const utr = `DUP${Date.now()}`;
    await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(1000),
      utrNumber: utr,
      paymentMode: 'IMPS'
    });
    await expect(
      FundRequestService.createRequest(merchantProfileId, {
        amount: new Prisma.Decimal(2000),
        utrNumber: utr,
        paymentMode: 'NEFT'
      })
    ).rejects.toThrow(DuplicateUtrError);
  });

  it('should successfully approve a request and update balances', async () => {
    const utr = `APP${Date.now()}`;
    const req = await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(1000),
      utrNumber: utr,
      paymentMode: 'IMPS'
    });
    const initialWallet = await db.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const approved = await FundRequestService.approveRequest(req.id, adminUserId);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedById).toBe(adminUserId);
    const updatedWallet = await db.wallet.findUniqueOrThrow({ where: { id: walletId } });
    expect(updatedWallet.balance.toNumber()).toBe(initialWallet.balance.toNumber() + 1000);
    const entries = await db.ledgerEntry.findMany({ where: { referenceId: req.id } });
    expect(entries.length).toBe(1);
    expect(entries[0].amount.toNumber()).toBe(1000);
    expect(entries[0].creditAccountId).toBe(merchantLedgerId);
  });

  it('should prevent double approval (Optimistic Lock)', async () => {
    const utr = `DBL${Date.now()}`;
    const req = await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(1000),
      utrNumber: utr,
      paymentMode: 'IMPS'
    });
    await FundRequestService.approveRequest(req.id, adminUserId);
    await expect(
      FundRequestService.approveRequest(req.id, adminUserId)
    ).rejects.toThrow(InvalidStateError);
  });

  it('should successfully reject a request and leave balance unchanged', async () => {
    const utr = `REJ${Date.now()}`;
    const req = await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(1000),
      utrNumber: utr,
      paymentMode: 'IMPS'
    });
    const initialWallet = await db.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const rejected = await FundRequestService.rejectRequest(req.id, adminUserId, 'Invalid UTR');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Invalid UTR');
    const updatedWallet = await db.wallet.findUniqueOrThrow({ where: { id: walletId } });
    expect(updatedWallet.balance.toNumber()).toBe(initialWallet.balance.toNumber());
  });

  it('should prevent rejecting an already approved request', async () => {
    const utr = `REJ_APP${Date.now()}`;
    const req = await FundRequestService.createRequest(merchantProfileId, {
      amount: new Prisma.Decimal(1000),
      utrNumber: utr,
      paymentMode: 'IMPS'
    });
    await FundRequestService.approveRequest(req.id, adminUserId);
    await expect(
      FundRequestService.rejectRequest(req.id, adminUserId, 'Too late')
    ).rejects.toThrow(InvalidStateError);
  });

  it('should throw an Error when approving a non-existent request', async () => {
    await expect(
      FundRequestService.approveRequest('non-existent-id', adminUserId)
    ).rejects.toThrow('Not Found');
  });
});
