import "dotenv/config";
process.env.DISABLE_DEV_SCHEDULER = "true";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { UserRole, AccountStatus, KycStatus, LedgerAccountType, KycDataType } from "@prisma/client";

async function main() {
  const email = process.env.DEMO_MERCHANT_EMAIL || "merchant@payerupee.in";
  const password = process.env.DEMO_MERCHANT_PASSWORD || "Merchant@PayERupee2026!";
  const name = "Acme Retail Innovations";

  console.log(`Checking merchant user: ${email}...`);

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

  let profile = await db.merchantProfile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    profile = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: name,
        merchantType: "COMPANY",
        accountStatus: AccountStatus.ACTIVE,
        phone: "+91 98765 43210",
        kycApprovedAt: new Date(),
      },
    });
    console.log(`Created active merchant profile: ${profile.id}`);
  } else {
    profile = await db.merchantProfile.update({
      where: { id: profile.id },
      data: {
        accountStatus: AccountStatus.ACTIVE,
        kycApprovedAt: new Date(),
      },
    });
  }

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

  console.log("Merchant wallet credited with 75,000 INR.");
  console.log(`SUCCESS: Demo merchant provisioned: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
