import { logger } from "@/infrastructure/logger/logger";
import { db } from "@/infrastructure/database/db";

export async function dispatchLoginNotification(session: { userId: string, id: string, createdAt: Date | string, ipAddress?: string | null }) {
  try {
    const user = await db.user.findUnique({ 
      where: { id: session.userId }, 
      select: { name: true, email: true, createdAt: true, emailVerified: true, merchantProfile: { select: { id: true } } }
    });

    if (!user?.emailVerified) return;

    // Suppress login notification for the initial registration session
    const isInitialRegistration = Math.abs(new Date(session.createdAt).getTime() - new Date(user.createdAt).getTime()) < 60000;
    if (isInitialRegistration) return;

    let emailsEnabled = false;

    // Create in-app login notification and Security Event
    if (user.merchantProfile?.id) {
      // Check if a login notification was already created recently (to prevent duplicates if multiple hooks fire)
      const existing = await db.notification.findFirst({
        where: {
          merchantProfileId: user.merchantProfile.id,
          type: "LOGIN",
          createdAt: {
            gte: new Date(Date.now() - 5000) // Within the last 5 seconds
          }
        }
      });

      if (!existing) {
        // 1. In-App Notification (Existing)
        await db.notification.create({
          data: {
            merchantProfileId: user.merchantProfile.id,
            type: "LOGIN",
            title: "New Login",
            message: "A new login was detected on your account."
          }
        });

        // 2. Security Event Audit
        await db.securityEvent.create({
          data: {
            merchantProfileId: user.merchantProfile.id,
            eventType: "NEW_LOGIN",
            severity: "LOW",
            description: "Successful new login.",
            ipAddress: session.ipAddress || null
          }
        });
      }
    }

    const { getNotificationPreferences } = await import("@/modules/notifications/application/preference.service");
    const prefs = await getNotificationPreferences(session.userId);
    emailsEnabled = prefs.loginEmailsEnabled;

    if (emailsEnabled && user?.email && user?.name) {
      try {
        await db.outboxEvent.create({
          data: {
            referenceId: "LOGIN_" + session.id,
            referenceType: "EMAIL_DISPATCH",
            payload: {
              templateId: "LOGIN_NOTIFICATION",
              to: user.email,
              subject: "New Login to PayERupee",
              templateVariables: {
                name: user.name,
                time: new Date().toUTCString(),
                ip: session.ipAddress || "Unknown"
              }
            }
          }
        });
        
        const { triggerImmediateEmailDispatch } = await import("@/modules/notifications/application/email-outbox.dispatcher");
        await triggerImmediateEmailDispatch();
      } catch (err: any) {
        if (err.code !== 'P2002') {
          logger.error("Failed to enqueue login email:", err);
        }
      }
    }
  } catch (e) {
    logger.error("Failed to dispatch login notification:", e);
  }
}
