import { db } from "@/infrastructure/database/db";

export interface NotificationPreferences {
  loginEmailsEnabled: boolean;
  kycEmailsEnabled: boolean;
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  // Use upsert to atomically ensure a row exists.
  // If it already exists, update nothing.
  // If it doesn't exist, create it with the default values.
  const pref = await db.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      loginEmailsEnabled: true,
      kycEmailsEnabled: true
    }
  });

  return {
    loginEmailsEnabled: pref.loginEmailsEnabled,
    kycEmailsEnabled: pref.kycEmailsEnabled
  };
}

export async function updateNotificationPreferences(
  userId: string,
  input: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const pref = await db.notificationPreference.upsert({
    where: { userId },
    update: {
      ...(input.loginEmailsEnabled !== undefined && { loginEmailsEnabled: input.loginEmailsEnabled }),
      ...(input.kycEmailsEnabled !== undefined && { kycEmailsEnabled: input.kycEmailsEnabled })
    },
    create: {
      userId,
      loginEmailsEnabled: input.loginEmailsEnabled ?? true,
      kycEmailsEnabled: input.kycEmailsEnabled ?? true
    }
  });

  return {
    loginEmailsEnabled: pref.loginEmailsEnabled,
    kycEmailsEnabled: pref.kycEmailsEnabled
  };
}
