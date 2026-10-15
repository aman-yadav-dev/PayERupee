process.env.DISABLE_DEV_SCHEDULER = "true";
import "dotenv/config";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { UserRole, AccountStatus, KycStatus, PayoutStatus, PaymentMode, PayoutProvider, LedgerAccountType, KycDataType } from "@prisma/client";

async function main() {
  const email = "qa.merchant@payerupee.in";
  const password = "MerchantPassword123!";
  const name = "QA Merchant";

  console.log(`Ensuring merchant user: ${email}...`);

  let user = await db.user.findUnique({
    where: { email },
    include: { merchantProfile: true },
  });

  if (!user) {
    const created = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    if (created?.user?.id) {
      user = await db.user.update({
        where: { id: created.user.id },
        data: { role: UserRole.MERCHANT, emailVerified: true },
        include: { merchantProfile: true },
      });
      console.log(`Created merchant user: ${email}`);
    } else {
      throw new Error(`Failed to sign up merchant ${email}`);
    }
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: { role: UserRole.MERCHANT, emailVerified: true },
      include: { merchantProfile: true },
    });
    console.log(`Updated merchant user: ${email}`);
  }

  // Ensure MerchantProfile
  let profile = await db.merchantProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    profile = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: "QA Merchant Enterprises",
        merchantType: "COMPANY",
        accountStatus: AccountStatus.ACTIVE,
        phone: "+91 99999 88888",
        kycApprovedAt: new Date(),
      },
    });
    console.log(`Created merchant profile: ${profile.id}`);
  } else {
    profile = await db.merchantProfile.update({
      where: { id: profile.id },
      data: {
        accountStatus: AccountStatus.ACTIVE,
        kycApprovedAt: new Date(),
      },
    });
    console.log(`Updated merchant profile ${profile.id} to ACTIVE.`);
  }

  // Ensure Ledger Account & Wallet
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
    update: { balance: 75000.00 },
    create: {
      merchantProfileId: profile.id,
      ledgerAccountId: ledgerAcc.id,
      balance: 75000.00,
      currency: "INR",
    },
  });

  // Ensure KYC Application is APPROVED
  let kycApp = await db.kycApplication.findUnique({
    where: { merchantProfileId: profile.id },
    include: { cycles: true },
  });

  if (!kycApp) {
    kycApp = await db.kycApplication.create({
      data: {
        merchantProfileId: profile.id,
        cycles: {
          create: {
            cycleNumber: 1,
            isCurrentCycle: true,
            status: KycStatus.APPROVED,
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
                      label: "Company PAN",
                      dataType: KycDataType.STRING,
                      inputType: "TEXT",
                      isRequired: true,
                      section: "BUSINESS",
                      orderIndex: 1,
                    },
                  ],
                },
              },
            },
          },
        },
      },
      include: { cycles: true },
    });
    console.log("Created approved KYC application.");
  } else {
    await db.kycSubmissionCycle.updateMany({
      where: { applicationId: kycApp.id },
      data: { status: KycStatus.APPROVED },
    });
    console.log("Updated KYC application cycles to APPROVED.");
  }

  // Ensure at least 1 payout transaction exists
  let payout = await db.payout.findFirst({
    where: { merchantProfileId: profile.id },
  });

  if (!payout) {
    payout = await db.payout.create({
      data: {
        merchantProfileId: profile.id,
        idempotencyKey: `qa-payout-ref-${Date.now()}`,
        amount: 12500.00,
        fee: 15.00,
        tax: 2.70,
        totalDebitAmount: 12517.70,
        status: PayoutStatus.SUCCESS,
        paymentMode: PaymentMode.IMPS,
        provider: PayoutProvider.CASHFREE,
        accountHolderName: "Rajesh Kumar Supplies",
        accountNumber: "918273645012",
        ifscCode: "HDFC0001234",
        notes: "QA Verified Payout Sample",
      },
    });
    console.log(`Created payout transaction: ${payout.id}`);
  } else {
    console.log(`Existing payout transaction found: ${payout.id}`);
  }

  let transitAcc = await db.ledgerAccount.findFirst({
    where: { type: LedgerAccountType.SYSTEM_TRANSIT },
  });
  if (!transitAcc) {
    transitAcc = await db.ledgerAccount.create({
      data: {
        type: LedgerAccountType.SYSTEM_TRANSIT,
        currency: "INR",
      },
    });
  }

  // Ensure matching ledger entry
  const existingLedger = await db.ledgerEntry.findFirst({
    where: { payoutId: payout.id },
  });
  if (!existingLedger) {
    await db.ledgerEntry.create({
      data: {
        debitAccountId: ledgerAcc.id,
        creditAccountId: transitAcc.id,
        amount: 12500.00,
        purpose: "PRINCIPAL",
        referenceType: "PAYOUT",
        referenceId: payout.id,
        payoutId: payout.id,
        description: "Payout Principal",
      },
    });
    console.log("Created matching ledger entry for accounting audit.");
  } else {
    console.log("Matching ledger entry already exists.");
  }

  console.log("QA Merchant setup completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to setup QA merchant:", err);
  process.exit(1);
});
