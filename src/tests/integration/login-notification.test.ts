import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/infrastructure/database/db';
import { dispatchLoginNotification } from '@/modules/auth/application/login-notification.service';

vi.mock('@/modules/notifications/application/email-outbox.dispatcher', () => ({
  triggerImmediateEmailDispatch: vi.fn(),
}));

describe('Login Notification Lifecycle', () => {
  const testUserId = 'test-user-login-notif';
  const testProfileId = 'test-profile-login-notif';
  const testSessionId = 'test-session-login-notif';

  async function cleanup() {
    await db.notification.deleteMany({ where: { merchantProfileId: testProfileId } });
    await db.session.deleteMany({ where: { userId: testUserId } });
    await db.merchantProfile.deleteMany({ where: { userId: testUserId } });
    await db.notificationPreference.deleteMany({ where: { userId: testUserId } });
    await db.user.deleteMany({ where: { id: testUserId } });
  }

  beforeEach(async () => {
    await cleanup();
    await db.user.create({
      data: {
        id: testUserId,
        email: 'loginnotif@example.com',
        name: 'Login Notif User',
        emailVerified: true,
        createdAt: new Date(Date.now() - 100000), // Ensure it's not initial registration
        merchantProfile: {
          create: {
            id: testProfileId,
            merchantType: 'INDIVIDUAL',
            accountStatus: 'ACTIVE',
          }
        },
        notificationPreference: {
          create: {
            loginEmailsEnabled: true,
            kycEmailsEnabled: true
          }
        }
      }
    });

    await db.session.create({
      data: {
        id: testSessionId,
        userId: testUserId,
        token: 'test-token',
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      }
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('creates exactly one LOGIN notification per successful login', async () => {
    const session = await db.session.findUnique({ where: { id: testSessionId } });
    await dispatchLoginNotification(session!);

    const notifs = await db.notification.findMany({
      where: { merchantProfileId: testProfileId, type: 'LOGIN' }
    });

    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe('New Login');
    expect(notifs[0].read).toBe(false);

    // Verify idempotent - doesn't create duplicate if called again
    await dispatchLoginNotification(session!);
    const notifsAfter = await db.notification.findMany({
      where: { merchantProfileId: testProfileId, type: 'LOGIN' }
    });
    expect(notifsAfter.length).toBe(1); // STILL 1!
  });

  it('creates no LOGIN notification for unverified emails', async () => {
    await db.user.update({ where: { id: testUserId }, data: { emailVerified: false } });
    const session = await db.session.findUnique({ where: { id: testSessionId } });
    
    await dispatchLoginNotification(session!);

    const notifs = await db.notification.findMany({
      where: { merchantProfileId: testProfileId, type: 'LOGIN' }
    });

    expect(notifs.length).toBe(0);
  });
});
