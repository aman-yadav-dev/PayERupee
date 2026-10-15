import { db } from "@/infrastructure/database/db";
import { Prisma, LedgerAccountType, Currency } from "@prisma/client";
import { adjustWalletBalance } from "../domain/wallet.service";
import { createLedgerEntry } from "@/modules/ledger/domain/ledger.service";
import { BanService } from "@/modules/ban/domain/ban.service";
import { DestinationBannedError } from "@/modules/payout/domain/payout.service";

export { DestinationBannedError };

export class DuplicateWithdrawalError extends Error {
  constructor() {
    super("Duplicate withdrawal request detected.");
    this.name = "DuplicateWithdrawalError";
  }
}

export class InvalidStateError extends Error {
  constructor(msg = "Invalid withdrawal state transition.") {
    super(msg);
    this.name = "InvalidStateError";
  }
}

export class WithdrawalService {
  static async createWithdrawal(
    merchantProfileId: string,
    data: {
      merchantBankId: string;
      amount: Prisma.Decimal;
      idempotencyKey: string;
    }
  ) {
    if (data.amount.lte(0)) throw new Error("Amount must be greater than zero");

    return await db.$transaction(async (tx) => {
      // Enforce configured minimum withdrawal limit
      const settings = await tx.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
      if (!settings) throw new Error("System settings not found");
      if (data.amount.lt(settings.minWithdrawAmount)) {
        throw new Error(`Minimum withdrawal amount is ${settings.minWithdrawAmount}`);
      }

      // Check idempotency
      const existing = await tx.withdrawal.findUnique({
        where: {
          merchantProfileId_idempotencyKey: {
            merchantProfileId,
            idempotencyKey: data.idempotencyKey
          }
        }
      });
      if (existing) throw new DuplicateWithdrawalError();

      // Look up merchantBank details
      const bank = await tx.merchantBank.findFirst({
        where: {
          id: data.merchantBankId,
          merchantProfileId,
        }
      });
      if (!bank) throw new Error("Merchant bank account not found");

      // Check destination ban policy
      const banCheck = await BanService.checkDestinationBan(
        { type: "BANK_ACCOUNT", accountNumber: bank.accountNumber, ifsc: bank.ifscCode },
        merchantProfileId
      );
      if (banCheck.isBanned) {
        throw new DestinationBannedError("Withdrawal destination is restricted by ban policy.", {
          banScope: banCheck.banScope,
          banReason: banCheck.reason,
          maskedDestination: banCheck.maskedDestination,
        });
      }

      // Get wallet
      const wallet = await tx.wallet.findUnique({
        where: { merchantProfileId }
      });
      if (!wallet) throw new Error("Wallet not found");

      // Get Transit Account
      const transit = await tx.ledgerAccount.findFirst({
        where: { type: LedgerAccountType.SYSTEM_TRANSIT }
      });
      if (!transit) throw new Error("SYSTEM_TRANSIT account not found");

      let withdrawal;
      try {
        withdrawal = await tx.withdrawal.create({
          data: {
            merchantProfileId,
            merchantBankId: data.merchantBankId,
            idempotencyKey: data.idempotencyKey,
            amount: data.amount,
            totalDebitAmount: data.amount, // No fees for now
            status: 'PENDING'
          }
        });
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new DuplicateWithdrawalError();
        }
        throw err;
      }

      // Debit Wallet Immediately
      await adjustWalletBalance(
        wallet.id,
        merchantProfileId,
        data.amount.negated(),
        wallet.version,
        tx
      );

      // Create Ledger Entry: MERCHANT_WALLET -> SYSTEM_TRANSIT
      await createLedgerEntry({
        amount: data.amount,
        debitAccountId: wallet.ledgerAccountId,
        creditAccountId: transit.id,
        referenceId: withdrawal.id,
        referenceType: 'WITHDRAWAL',
        purpose: 'PRINCIPAL',
        description: 'Withdrawal'
      }, tx);

      return withdrawal;
    });
  }

  /**
   * ACTUAL CURRENT WITHDRAWAL STATE MACHINE:
   * PENDING -> SUCCESS via admin approval (No financial mutation, wallet already locked at creation)
   * PENDING -> FAILED via admin rejection (Wallet is refunded + REVERSAL_PRINCIPAL ledger entry created)
   */
  static async approveWithdrawal(id: string, adminUserId: string) {
    return await db.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) throw new Error("Withdrawal not found");
      if (withdrawal.status !== 'PENDING') throw new InvalidStateError("Only PENDING withdrawals can be approved");

      const updated = await tx.withdrawal.update({
        where: { id, status: 'PENDING' },
        data: {
          status: 'SUCCESS',
          processedAt: new Date()
        }
      });
      return updated;
    });
  }

  static async rejectWithdrawal(id: string, adminUserId: string, reason: string) {
    return await db.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) throw new Error("Withdrawal not found");
      if (withdrawal.status !== 'PENDING') throw new InvalidStateError("Only PENDING withdrawals can be rejected");

      const updated = await tx.withdrawal.update({
        where: { id, status: 'PENDING' },
        data: {
          status: 'FAILED',
          failureReason: reason,
          processedAt: new Date()
        }
      });

      // Get wallet
      const wallet = await tx.wallet.findUnique({
        where: { merchantProfileId: withdrawal.merchantProfileId }
      });
      if (!wallet) throw new Error("Wallet not found");

      // Get Transit Account
      const transit = await tx.ledgerAccount.findFirst({
        where: { type: LedgerAccountType.SYSTEM_TRANSIT }
      });
      if (!transit) throw new Error("SYSTEM_TRANSIT account not found");

      // Refund Wallet
      await adjustWalletBalance(
        wallet.id,
        updated.merchantProfileId,
        updated.totalDebitAmount,
        wallet.version,
        tx
      );

      // Reversal Ledger Entry: SYSTEM_TRANSIT -> MERCHANT_WALLET
      await createLedgerEntry({
        amount: updated.totalDebitAmount,
        debitAccountId: transit.id,
        creditAccountId: wallet.ledgerAccountId,
        referenceId: withdrawal.id,
        referenceType: 'WITHDRAWAL',
        purpose: 'REVERSAL_PRINCIPAL',
        description: 'Withdrawal Reversal'
      }, tx);

      return updated;
    });
  }
}
