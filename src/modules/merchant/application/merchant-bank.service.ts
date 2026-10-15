import { db } from "@/infrastructure/database/db";

export class MerchantBankService {
  static async getBanks(merchantProfileId: string) {
    return await db.merchantBank.findMany({
      where: { merchantProfileId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async addBank(merchantProfileId: string, data: { accountNumber: string; ifscCode: string; accountHolderName: string }) {
    return await db.merchantBank.create({
      data: {
        merchantProfileId,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        accountHolderName: data.accountHolderName,
        isVerified: true, // Auto-verifying for this MVP scope
        isActive: true
      }
    });
  }

  static async getBankOrThrow(id: string, merchantProfileId: string) {
    const bank = await db.merchantBank.findUnique({
      where: { id, merchantProfileId, deletedAt: null }
    });
    if (!bank) throw new Error("Merchant bank not found or access denied");
    return bank;
  }
}
