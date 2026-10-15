import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import { adjustWalletBalance } from "../domain/wallet.service";
import { createLedgerEntry } from "@/modules/ledger/domain/ledger.service";

export class DuplicateUtrError extends Error {
  constructor(message = "A request with this UTR number already exists.") {
    super(message);
    this.name = "DuplicateUtrError";
  }
}

export class InvalidStateError extends Error {
  constructor(message = "Request is no longer pending.") {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class FundRequestService {
  static async createRequest(merchantProfileId: string, payload: { amount: Prisma.Decimal; utrNumber: string; paymentMode: any; receiptUrl?: string; remarks?: string }) {
    try {
      const settings = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
      if (!settings) throw new Error("System settings not found");
      if (payload.amount.lt(settings.minAddFundsAmount)) {
        throw new Error(`Minimum add funds amount is ${settings.minAddFundsAmount}`);
      }

      const request = await db.fundRequest.create({
        data: {
          merchantProfileId,
          amount: payload.amount,
          utrNumber: payload.utrNumber,
          paymentMode: payload.paymentMode,
          receiptUrl: payload.receiptUrl,
          remarks: payload.remarks,
          status: "PENDING",
        }
      });
      return request;
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DuplicateUtrError();
      }
      throw e;
    }
  }

  static async approveRequest(id: string, adminId: string) {
    try {
      return await db.$transaction(async (tx) => {
        // 1. Fetch and Lock Status
        const req = await tx.fundRequest.findUnique({ where: { id } });
        if (!req) throw new Error("Not Found");
        if (req.status !== "PENDING") throw new InvalidStateError();

        const updated = await tx.fundRequest.update({
          where: { id, status: "PENDING" },
          data: {
            status: "APPROVED",
            approvedById: adminId,
            processedAt: new Date(),
          }
        });

        // 2. Fetch Wallet & System Transit
        const wallet = await tx.wallet.findUnique({
          where: { merchantProfileId: updated.merchantProfileId }
        });
        if (!wallet) throw new Error("Wallet not found");

        const transitAccount = await tx.ledgerAccount.findFirst({
          where: { type: "SYSTEM_TRANSIT", currency: "INR" }
        });
        if (!transitAccount) throw new Error("System transit account not configured");

        // 3. Ledger Entry
        await createLedgerEntry({
          amount: updated.amount,
          debitAccountId: transitAccount.id,
          creditAccountId: wallet.ledgerAccountId,
          purpose: "PRINCIPAL",
          referenceType: "FUND_REQUEST",
          referenceId: updated.id,
          description: `Add Funds approved - UTR: ${updated.utrNumber}`
        }, tx);

        // 4. Update Wallet Balance
        await adjustWalletBalance(
          wallet.id,
          updated.merchantProfileId,
          updated.amount,
          wallet.version,
          tx
        );

        return updated;
      });
    } catch (e: any) {
       if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
         throw new InvalidStateError();
       }
       throw e;
    }
  }

  static async rejectRequest(id: string, adminId: string, reason?: string) {
    try {
      return await db.fundRequest.update({
        where: { id, status: "PENDING" },
        data: {
          status: "REJECTED",
          approvedById: adminId,
          processedAt: new Date(),
          rejectionReason: reason || null
        }
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
         throw new InvalidStateError();
      }
      throw e;
    }
  }
}
