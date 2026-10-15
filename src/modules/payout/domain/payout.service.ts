import { db } from "@/infrastructure/database/db";
import { Prisma, PayoutStatus, LedgerEntryPurpose, ReferenceType, PaymentMode, AuditActorType, AuditEntity, AuditAction } from "@prisma/client";
import { adjustWalletBalance } from "@/modules/wallet/domain/wallet.service";
import { createLedgerEntry } from "@/modules/ledger/domain/ledger.service";
import { logAction } from "@/modules/audit/domain/audit.service";
import { BanService } from "@/modules/ban/domain/ban.service";
import { BanDestinationInput } from "@/modules/ban/application/ban-crypto.service";
import { z } from "zod";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;


export class DestinationBannedError extends Error {
  public banScope?: "GLOBAL" | "MERCHANT";
  public banReason?: string;
  public maskedDestination?: string;
  constructor(message: string, options?: { banScope?: "GLOBAL" | "MERCHANT"; banReason?: string; maskedDestination?: string }) {
    super(message);
    this.name = "DestinationBannedError";
    this.banScope = options?.banScope;
    this.banReason = options?.banReason;
    this.maskedDestination = options?.maskedDestination;
  }
}

export class PayoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutValidationError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor(message = "Idempotency-Key has already been used with a different request.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IllegalStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition payout from ${from} to ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}

export class SystemConfigurationError extends Error {
  constructor(message = "System settings missing. Halting all financial operations.") {
    super(message);
    this.name = "SystemConfigurationError";
  }
}

export const PayoutRequestSchema = z.object({
  amount: z.union([z.string(), z.number()])
    .transform(val => String(val))
    .refine(val => !isNaN(Number(val)) && Number(val) > 0, "Must be a positive decimal"),
  paymentMode: z.nativeEnum(PaymentMode).refine(m => m === PaymentMode.UPI || m === PaymentMode.IMPS, "Unsupported payment mode. Only UPI and IMPS are allowed.").optional(),
    merchantReference: z.string().max(100).optional(),
  
  // Bank destination (optional at base level)
  accountNumber: z.string().min(5).max(30).optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code").optional(),
  accountHolderName: z.string().min(2).optional(),
  
  // UPI destination
  vpa: z.string().regex(/^[\w.-]+@[\w.-]+$/, "Invalid VPA format").optional(),
  
  beneficiaryPhone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format").optional(),
}).refine(data => {
  const mode = data.paymentMode || PaymentMode.IMPS;
  if (mode === PaymentMode.UPI) {
    return !!data.vpa;
  }
  return !!data.accountNumber && !!data.ifscCode && !!data.accountHolderName;
}, {
  message: "Invalid destination. Bank payouts require accountNumber, ifscCode, and accountHolderName. UPI payouts require vpa."
});

export type CreatePayoutInput = z.infer<typeof PayoutRequestSchema>;

async function getSystemSettings() {
  const settings = await db.systemSetting.findUnique({
    where: { id: "GLOBAL_SETTINGS" }
  });
  if (!settings) {
    throw new SystemConfigurationError();
  }
  return settings;
}


async function resolvePayoutFee(paymentMode: PaymentMode, amount: Prisma.Decimal): Promise<Prisma.Decimal> {
  const rules = await db.payoutFeeRule.findMany({
    where: { paymentMode, isActive: true }
  });

  if (rules.length === 0) {
    throw new PayoutValidationError(`No active pricing rules found for ${paymentMode}`);
  }

  const matchingRules = rules.filter(rule => amount.gte(rule.minAmount) && amount.lte(rule.maxAmount));
  
  if (matchingRules.length === 0) {
    throw new PayoutValidationError(`Amount ${amount.toString()} falls outside supported pricing tiers for ${paymentMode}`);
  }
  
  if (matchingRules.length > 1) {
    throw new PayoutValidationError(`Configuration error: Multiple overlapping active rules match amount ${amount.toString()} for ${paymentMode}`);
  }

  return matchingRules[0].fee;
}

export async function createPayout(merchantProfileId: string, environment: "TEST" | "LIVE", idempotencyKey: string, inputData: unknown) {
  // 1. Zod Validation
  const input = PayoutRequestSchema.parse(inputData);
  const amountDecimal = new Decimal(input.amount);
  const paymentMode = input.paymentMode || PaymentMode.IMPS;
  
  // 2. Fail-Closed Settings
  const settings = await getSystemSettings();

  // 3. Min/Max Validation
  if (amountDecimal.lt(settings.minPayoutAmount) || amountDecimal.gt(settings.maxPayoutAmount)) {
    throw new PayoutValidationError(`Amount must be between ${settings.minPayoutAmount} and ${settings.maxPayoutAmount}`);
  }

  // Calculate fees server-side
  const fee = await resolvePayoutFee(paymentMode, amountDecimal);
  
  const tax = fee.mul(settings.taxPercentage).div(100);
  const totalDebitAmount = amountDecimal.add(fee).add(tax);

  // Check if payout already exists for idempotency before ban check / creation
  const existingPayout = await db.payout.findUnique({
    where: {
      merchantProfileId_idempotencyKey_environment: {
        merchantProfileId,
        idempotencyKey,
        environment,
      }
    }
  });

  if (existingPayout) {
    // Idempotency Conflict Detection
    // Compare canonical request fields
    const isSameAmount = new Decimal(existingPayout.amount).eq(amountDecimal);
    const isSameMode = existingPayout.paymentMode === paymentMode;
    const isSameMerchantRef = (existingPayout.merchantReference || "") === (input.merchantReference || "");
    const isSameAccNumber = (existingPayout.accountNumber || "") === (input.accountNumber || "");
    const isSameIfsc = (existingPayout.ifscCode || "") === (input.ifscCode || "");
    const isSameName = (existingPayout.accountHolderName || "") === (input.accountHolderName || "");
    const isSameVpa = (existingPayout.vpa || "") === (input.vpa || "");
    const isSamePhone = (existingPayout.beneficiaryPhone || "") === (input.beneficiaryPhone || "");

    if (!isSameAmount || !isSameMode || !isSameMerchantRef || !isSameAccNumber || !isSameIfsc || !isSameName || !isSameVpa || !isSamePhone) {
      throw new IdempotencyConflictError();
    }

    return { payout: existingPayout, isNew: false };
  }

  // Destination ban check enforcement
  const destinationInput: BanDestinationInput =
    paymentMode === PaymentMode.UPI
      ? { type: "UPI", vpa: input.vpa! }
      : { type: "BANK_ACCOUNT", accountNumber: input.accountNumber!, ifsc: input.ifscCode! };

  const banCheck = await BanService.checkDestinationBan(destinationInput, merchantProfileId);
  if (banCheck.isBanned) {
    throw new DestinationBannedError("Payout destination is restricted by ban policy.", {
      banScope: banCheck.banScope,
      banReason: banCheck.reason,
      maskedDestination: banCheck.maskedDestination,
    });
  }

  try {
    const payout = await db.payout.create({
      data: {
        merchantProfileId,
        environment,
        idempotencyKey,
        amount: amountDecimal,
        fee,
        tax,
        totalDebitAmount,
        status: PayoutStatus.PENDING,
        paymentMode,
          merchantReference: input.merchantReference || null,
        accountNumber: input.accountNumber || null,
        ifscCode: input.ifscCode || null,
        accountHolderName: input.accountHolderName || null,
        vpa: input.vpa || null,
        beneficiaryPhone: input.beneficiaryPhone || null,
      },
    });
    return { payout, isNew: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Idempotency constraint triggered
      const existing = await db.payout.findUnique({
        where: {
          merchantProfileId_idempotencyKey_environment: {
            merchantProfileId,
            idempotencyKey,
            environment,
          }
        }
      });
      if (!existing) throw new Error("Idempotency resolution failed");
      
        // Idempotency Conflict Detection
        // Compare canonical request fields
        const isSameAmount = new Decimal(existing.amount).eq(amountDecimal);
        const isSameMode = existing.paymentMode === paymentMode;
        const isSameMerchantRef = (existing.merchantReference || "") === (input.merchantReference || "");
        const isSameAccNumber = (existing.accountNumber || "") === (input.accountNumber || "");
        const isSameIfsc = (existing.ifscCode || "") === (input.ifscCode || "");
        const isSameName = (existing.accountHolderName || "") === (input.accountHolderName || "");
        const isSameVpa = (existing.vpa || "") === (input.vpa || "");
        const isSamePhone = (existing.beneficiaryPhone || "") === (input.beneficiaryPhone || "");

        if (!isSameAmount || !isSameMode || !isSameMerchantRef || !isSameAccNumber || !isSameIfsc || !isSameName || !isSameVpa || !isSamePhone) {
          throw new IdempotencyConflictError();
        }

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

    // 4. Ledger Entries and Wallet Adjustment (ONLY FOR LIVE)
    if (payout.environment === "LIVE") {
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
    }

    // 6. Audit
    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.PAYOUT,
      entityId: payout.id,
      action: AuditAction.PROCESS,
      metadata: { fromStatus: "PENDING", toStatus: "PROCESSING" }
    }, tx);

    // 7. Outbox (Reliable Dispatch)
    await tx.outboxEvent.create({
      data: {
        referenceType: "PAYOUT_DISPATCH",
        referenceId: payout.id,
        status: "PENDING",
        lockedUntil: new Date(Date.now() + 60000), // Lock for 60s for inline orchestrator
        lockedBy: "inline-orchestrator",
        attempts: 1 // ATOMIC: Mark as attempted to prevent double-dispatch if inline process crashes during HTTP call
      }
    });

    return updatedPayout;
  }, { maxWait: 5000, timeout: 20000 });
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
  }, { maxWait: 5000, timeout: 20000 });
}

export async function failPayout(payoutId: string, merchantProfileId: string, reason?: string, providerFailureDetails?: Record<string, unknown> | null) {
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
          providerFailureDetails: providerFailureDetails ? (providerFailureDetails as Prisma.InputJsonValue) : undefined,
        processedAt: new Date(),
      }
    });

    // Compensating Ledgers (ONLY FOR LIVE)
    if (payout.environment === "LIVE") {
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
    }

    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.PAYOUT,
      entityId: payout.id,
      action: AuditAction.UPDATE,
      metadata: { status: "FAILED", reason }
    }, tx);

    return updatedPayout;
  }, { maxWait: 5000, timeout: 20000 });
}

export async function reversePayout(payoutId: string, merchantProfileId: string, reason?: string) {
  return await db.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId, merchantProfileId } });
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== PayoutStatus.SUCCESS) {
      throw new IllegalStateTransitionError(payout.status, PayoutStatus.REVERSED);
    }

    const wallet = await tx.wallet.findUnique({ where: { merchantProfileId } });
    if (!wallet) throw new Error("Wallet not found");

    const transitAccount = await tx.ledgerAccount.findFirst({ where: { type: "SYSTEM_TRANSIT" } });
    const revenueAccount = await tx.ledgerAccount.findFirst({ where: { type: "SYSTEM_REVENUE" } });
    if (!transitAccount || !revenueAccount) throw new Error("System accounts missing");

    // Transition to REVERSED
    const updatedPayout = await tx.payout.update({
      where: { id: payoutId, merchantProfileId, status: PayoutStatus.SUCCESS },
      data: {
        status: PayoutStatus.REVERSED,
        failureReason: reason,
        processedAt: new Date(),
      }
    });

    // Compensating Ledgers (ONLY FOR LIVE)
    if (payout.environment === "LIVE") {
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
    }

    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.PAYOUT,
      entityId: payout.id,
      action: AuditAction.UPDATE,
      metadata: { status: "REVERSED", reason }
    }, tx);

    return updatedPayout;
  }, { maxWait: 5000, timeout: 20000 });
}
