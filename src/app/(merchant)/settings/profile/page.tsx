import React from "react";
import { headers } from "next/headers";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { ProfileClient } from "./ProfileClient";

export const metadata = {
  title: "Profile | PayERupee",
};

export default async function SettingsProfilePage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return null;
  }

  const [user, profile, latestSession] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id } }),
    db.merchantProfile.findUnique({ where: { userId: session.user.id } }),
    db.session.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let walletBalance = null;
  if (profile) {
    const wallet = await db.wallet.findUnique({ where: { merchantProfileId: profile.id } });
    if (wallet) {
      walletBalance = wallet.balance.toString();
    }
  }

  const serializedUser = user ? {
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString()
  } : null;

  const serializedProfile = profile ? {
    phone: profile.phone,
    address: profile.address,
    accountStatus: profile.accountStatus,
  } : null;

  return (
    <ProfileClient
      user={serializedUser}
      profile={serializedProfile}
      walletBalance={walletBalance}
      lastLogin={latestSession ? latestSession.createdAt.toISOString() : null}
    />
  );
}
