import { db } from "@/lib/db";
import { Prisma, PayoutStatus, LedgerEntryPurpose, ReferenceType, PaymentMode, AuditActorType, AuditEntity, AuditAction } from "@prisma/client";
import { adjustWalletBalance } from "./wallet.service";
import { createLedgerEntry } from "./ledger.service";
import { logAction } from "./audit.service";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export class IllegalStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition payout from ${from} to ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}

export type CreatePayoutInput = {
  idempotencyKey: string;
  amount: string | number | Decimal;
  paymentMode?: PaymentMode;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  beneficiaryPhone?: string;
};

async function getSystemSettings() {
  const settings = await db.systemSetting.findUnique({
    where: { id: "GLOBAL_SETTINGS" }
  });
  if (settings) return settings;
  // Fallback if not seeded
  return {
    upiPayoutFee: new Decimal(0),
    impsPayoutFee: new Decimal(5),
    neftPayoutFee: new Decimal(3),
    rtgsPayoutFee: new Decimal(10),
    taxPercentage: new Decimal(18),
  };
}

export async function createPayout(merchantProfileId: string, input: CreatePayoutInput) {
  const amountDecimal = new Decimal(input.amount);
  const paymentMode = input.paymentMode || PaymentMode.IMPS;
  
  // Calculate fees server-side
  const settings = await getSystemSettings();
  let fee = new Decimal(0);
  switch (paymentMode) {
    case PaymentMode.UPI: fee = settings.upiPayoutFee; break;
    case PaymentMode.IMPS: fee = settings.impsPayoutFee; break;
    case PaymentMode.NEFT: fee = settings.neftPayoutFee; break;
    case PaymentMode.RTGS: fee = settings.rtgsPayoutFee; break;
  }
  
  const tax = fee.mul(settings.taxPercentage).div(100);
  const totalDebitAmount = amountDecimal.add(fee).add(tax);

  try {
    const payout = await db.payout.create({
      data: {
        merchantProfileId,
        idempotencyKey: input.idempotencyKey,
        amount: amountDecimal,
        fee,
        tax,
        totalDebitAmount,
        status: PayoutStatus.PENDING,
        paymentMode,
        accountNumber: input.accountNumber,
        ifscCode: input.ifscCode,
        accountHolderName: input.accountHolderName,
        beneficiaryPhone: input.beneficiaryPhone,
      },
    });
    return { payout, isNew: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Idempotency constraint triggered
      const existing = await db.payout.findUnique({
        where: {
          merchantProfileId_idempotencyKey: {
            merchantProfileId,
            idempotencyKey: input.idempotencyKey,
          }
        }
      });
      if (!existing) throw new Error("Idempotency resolution failed");
      return { payout: existing, isNew: false };
    }
    throw error;
  }
}

export async function processPayout(payoutId: string, merchantProfileId: string) {
  return await db.$transaction(async (tx) => {
    // 1. Fetch & lock payout
    const payout = await tx.payout.findUnique({
      where: { id: payoutId, merchantProfileId }
    });
    
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== PayoutStatus.PENDING) {
      throw new IllegalStateTransitionError(payout.status, PayoutStatus.PROCESSING);
    }

    // 2. Fetch required accounts
    const wallet = await tx.wallet.findUnique({
      where: { merchantProfileId },
      include: { ledgerAccount: true }
    });
    if (!wallet) throw new Error("Merchant wallet not found");

    const transitAccount = await tx.ledgerAccount.findFirst({
      where: { type: "SYSTEM_TRANSIT" }
    });
    const revenueAccount = await tx.ledgerAccount.findFirst({
      where: { type: "SYSTEM_REVENUE" }
    });
    if (!transitAccount || !revenueAccount) throw new Error("System accounts missing");

    // 3. Transition to PROCESSING
    const updatedPayout = await tx.payout.update({
      where: { id: payoutId, merchantProfileId, status: PayoutStatus.PENDING },
      data: { status: PayoutStatus.PROCESSING }
    });

    // 4. Ledger Entries
    await createLedgerEntry({
      amount: payout.amount,
      debitAccountId: wallet.ledgerAccountId,
      creditAccountId: transitAccount.id,
      purpose: LedgerEntryPurpose.PRINCIPAL,
      referenceType: ReferenceType.PAYOUT,
      referenceId: payout.id,
      payoutId: payout.id,
      description: "Payout Principal",
    }, tx);

    const feeAndTax = payout.fee.add(payout.tax);
    if (feeAndTax.gt(0)) {
      await createLedgerEntry({
        amount: feeAndTax,
        debitAccountId: wallet.ledgerAccountId,
        creditAccountId: revenueAccount.id,
        purpose: LedgerEntryPurpose.FEE_AND_TAX,
        referenceType: ReferenceType.PAYOUT,
        referenceId: payout.id,
        payoutId: payout.id,
        description: "Payout Fee & Tax",
      }, tx);
    }

    // 5. Adjust Wallet
    await adjustWalletBalance(
      wallet.id,
      merchantProfileId,
      payout.totalDebitAmount.negated(),
      wallet.version,
      tx
    );

    // 6. Audit
    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.PAYOUT,
      entityId: payout.id,
      action: AuditAction.PROCESS,
      metadata: { fromStatus: "PENDING", toStatus: "PROCESSING" }
    }, tx);

    return updatedPayout;
  });
}

export async function handlePayoutSuccess(payoutId: string, merchantProfileId: string, providerReference?: string) {
  return await db.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId, merchantProfileId } });
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== PayoutStatus.PROCESSING) {
      throw new IllegalStateTransitionError(payout.status, PayoutStatus.SUCCESS);
    }

    const updated = await tx.payout.update({
      where: { id: payoutId, merchantProfileId, status: PayoutStatus.PROCESSING },
      data: { 
        status: PayoutStatus.SUCCESS,
        providerReference,
        processedAt: new Date(),
      }
    });

    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.PAYOUT,
      entityId: payout.id,
      action: AuditAction.UPDATE,
      metadata: { status: "SUCCESS" }
    }, tx);

    return updated;
  });
}

export async function reversePayout(payoutId: string, merchantProfileId: string, reason?: string) {
  return await db.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId, merchantProfileId } });
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== PayoutStatus.PROCESSING) {
      throw new IllegalStateTransitionError(payout.status, PayoutStatus.FAILED);
    }

    const wallet = await tx.wallet.findUnique({ where: { merchantProfileId } });
    if (!wallet) throw new Error("Wallet not found");

    const transitAccount = await tx.ledgerAccount.findFirst({ where: { type: "SYSTEM_TRANSIT" } });
    const revenueAccount = await tx.ledgerAccount.findFirst({ where: { type: "SYSTEM_REVENUE" } });
    if (!transitAccount || !revenueAccount) throw new Error("System accounts missing");

    // Transition to FAILED
    const updatedPayout = await tx.payout.update({
      where: { id: payoutId, merchantProfileId, status: PayoutStatus.PROCESSING },
      data: { 
        status: PayoutStatus.FAILED,
        failureReason: reason,
        processedAt: new Date(),
      }
    });

    // Compensating Ledgers
    await createLedgerEntry({
      amount: payout.amount,
      creditAccountId: wallet.ledgerAccountId,
      debitAccountId: transitAccount.id,
      purpose: LedgerEntryPurpose.REVERSAL_PRINCIPAL,
      referenceType: ReferenceType.PAYOUT,
      referenceId: payout.id,
      payoutId: payout.id,
      description: "Payout Reversal Principal",
    }, tx);

    const feeAndTax = payout.fee.add(payout.tax);
    if (feeAndTax.gt(0)) {
      await createLedgerEntry({
        amount: feeAndTax,
        creditAccountId: wallet.ledgerAccountId,
        debitAccountId: revenueAccount.id,
        purpose: LedgerEntryPurpose.REVERSAL_FEE_AND_TAX,
        referenceType: ReferenceType.PAYOUT,
        referenceId: payout.id,
        payoutId: payout.id,
        description: "Payout Reversal Fee & Tax",
      }, tx);
    }

    // Adjust Wallet Back
    await adjustWalletBalance(
      wallet.id,
      merchantProfileId,
      payout.totalDebitAmount, // POSITIVE amount to refund
      wallet.version,
      tx
    );

    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.PAYOUT,
      entityId: payout.id,
      action: AuditAction.UPDATE,
      metadata: { status: "FAILED", reason }
    }, tx);

    return updatedPayout;
  });
}
