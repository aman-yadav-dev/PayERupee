import "dotenv/config";
process.env.DISABLE_DEV_SCHEDULER = "true";
import { db } from "@/infrastructure/database/db";
import { KycStatus, AccountStatus, UserRole, KycDataType, LedgerAccountType } from "@prisma/client";

async function main() {
  console.log("Seeding sample merchants and KYC applications for browser QA...");

  const merchantCount = await db.merchantProfile.count();
  if (merchantCount >= 2) {
    console.log(`Already have ${merchantCount} merchant profiles.`);
  } else {
    for (let i = 1; i <= 2; i++) {
      const email = `merchant${i}.qa@payerupee.com`;
      const name = `Acme Retail Solutions ${i}`;
      
      const user = await db.user.upsert({
        where: { email },
        update: { role: UserRole.MERCHANT, name },
        create: {
          email,
          name,
          role: UserRole.MERCHANT,
          emailVerified: true,
        },
      });

      const profile = await db.merchantProfile.upsert({
        where: { userId: user.id },
        update: { businessName: name, accountStatus: AccountStatus.PENDING },
        create: {
          userId: user.id,
          businessName: name,
          merchantType: "COMPANY",
          accountStatus: AccountStatus.PENDING,
          phone: "+91 98765 43210",
        },
      });

      // Ledger Account & Wallet
      let ledgerAcc = await db.ledgerAccount.findFirst({
        where: { merchantProfileId: profile.id, type: LedgerAccountType.MERCHANT_LIABILITY },
      });
      if (!ledgerAcc) {
        ledgerAcc = await db.ledgerAccount.create({
          data: {
            merchantProfileId: profile.id,
            type: LedgerAccountType.MERCHANT_LIABILITY,
            currency: "INR",
          },
        });
      }

      await db.wallet.upsert({
        where: { merchantProfileId: profile.id },
        update: {},
        create: {
          merchantProfileId: profile.id,
          ledgerAccountId: ledgerAcc.id,
          balance: 15400.50,
          currency: "INR",
        },
      });

      // Merchant Bank
      const bank = await db.merchantBank.findFirst({
        where: { merchantProfileId: profile.id },
      });
      if (!bank) {
        await db.merchantBank.create({
          data: {
            merchantProfileId: profile.id,
            accountHolderName: name,
            accountNumber: `98765432100${i}`,
            ifscCode: "HDFC0001234",
            isActive: true,
            isVerified: true,
          },
        });
      }

      // KYC Application
      const existingKyc = await db.kycApplication.findUnique({
        where: { merchantProfileId: profile.id },
      });

      if (!existingKyc) {
        const kycApp = await db.kycApplication.create({
          data: {
            merchantProfileId: profile.id,
            cycles: {
              create: {
                cycleNumber: 1,
                isCurrentCycle: true,
                status: KycStatus.UNDER_REVIEW,
                submittedAt: new Date(),
                formVersion: {
                  create: {
                    status: "PUBLISHED",
                    versionNumber: 1,
                    form: { create: { name: "Standard Merchant KYC" } },
                    fields: {
                      create: [
                        {
                          key: "pan_number",
                          label: "Company PAN Number",
                          dataType: KycDataType.STRING,
                          inputType: "TEXT",
                          isRequired: true,
                          section: "BUSINESS",
                          orderIndex: 1,
                        },
                        {
                          key: "incorporation_doc",
                          label: "Certificate of Incorporation",
                          dataType: KycDataType.FILE,
                          inputType: "FILE",
                          isRequired: true,
                          section: "DOCUMENTS",
                          orderIndex: 2,
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          include: {
            cycles: {
              include: {
                formVersion: {
                  include: { fields: true },
                },
              },
            },
          },
        });

        const cycle = kycApp.cycles[0];
        const fields = cycle.formVersion.fields;
        const panField = fields.find((f: { key: string }) => f.key === "pan_number");
        const docField = fields.find((f: { key: string }) => f.key === "incorporation_doc");

        if (panField) {
          await db.kycAnswer.create({
            data: {
              submissionCycleId: cycle.id,
              fieldDefinitionId: panField.id,
              value: "AAACR1234K",
            },
          });
        }

        if (docField) {
          await db.kycDocument.create({
            data: {
              submissionCycleId: cycle.id,
              fieldDefinitionId: docField.id,
              storageKey: `kyc-docs/${profile.id}/incorporation_certificate.pdf`,
              originalFilename: "incorporation_certificate.pdf",
              mimeType: "application/pdf",
              sizeBytes: 24580,
              status: "UPLOADED",
            },
          });
        }
      }
    }

    const pendingWithdrawal = await db.withdrawal.findFirst({
      where: { status: "PENDING" },
    });
    if (!pendingWithdrawal) {
      const firstBank = await db.merchantBank.findFirst();
      if (firstBank) {
        await db.withdrawal.create({
          data: {
            merchantProfileId: firstBank.merchantProfileId,
            merchantBankId: firstBank.id,
            idempotencyKey: `seed-wd-${Date.now()}`,
            amount: 2500.0,
            totalDebitAmount: 2500.0,
            status: "PENDING",
          },
        });
        console.log("Seeded pending withdrawal for UI verification.");
      }
    }
  }

  console.log("Seeding completed successfully.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

