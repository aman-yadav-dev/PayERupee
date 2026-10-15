import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/infrastructure/database/db';
import { onboardMerchant } from '@/modules/merchant/domain/merchant.service';
import { approveMerchantAccount } from '@/modules/admin/domain/admin-merchant.service';
import { randomUUID } from 'crypto';
import { AccountStatus } from '@prisma/client';
import { emailOutboxPayloadSchema } from '@/infrastructure/notifications/mailer';
import { auth } from '@/modules/auth/infrastructure/auth';

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
  })),
}));

describe('Email Lifecycle', () => {
  let user: any;

  beforeEach(async () => {
    await db.outboxEvent.deleteMany({});
    
    user = await db.user.create({
      data: {
        id: randomUUID(),
        name: 'Test Lifecycle User',
        email: 'test-' + randomUUID() + '@example.com',
        emailVerified: true,
        createdAt: new Date()
      }
    });
  });

  it('1. Email/password onboarding (unverified) creates zero REGISTRATION_SUCCESS events', async () => {
    // Make user unverified for this test
    await db.user.update({ where: { id: user.id }, data: { emailVerified: false } });
    
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz Unverified',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(0);
  });

  it('2. Google/already-verified registration creates exactly one REGISTRATION_SUCCESS during onboarding', async () => {
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    // user is created with emailVerified: true in beforeEach
    await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz Google',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);
    const regSuccess = events[0];
    expect((regSuccess.payload as any).templateId).toBe('REGISTRATION_SUCCESS');
    expect((regSuccess.payload as any).to).toBe(user.email);
    expect((regSuccess.payload as any).templateVariables.ctaLink).toContain('/kyc/start');
  });

  it('2b. if afterEmailVerification runs after verified onboarding, no duplicate is created (idempotent referenceId)', async () => {
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz Google 2',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    let events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);

    const hook = auth.options.emailVerification?.afterEmailVerification;
    await hook!(user as any);

    events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1); // Still 1!
  });

  it('3. generates exactly ONE combined REGISTRATION_SUCCESS on afterEmailVerification hook', async () => {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: false } });
    
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    const hook = auth.options.emailVerification?.afterEmailVerification;
    await hook!(user as any);

    const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });

    expect(events.length).toBe(1);
    
    const regSuccess = events[0];
    expect((regSuccess.payload as any).templateId).toBe('REGISTRATION_SUCCESS');
    emailOutboxPayloadSchema.parse(regSuccess.payload);
    expect((regSuccess.payload as any).to).toBe(user.email);
    // 7. combined Welcome email contains KYC CTA
    expect((regSuccess.payload as any).templateVariables.ctaLink).toContain('/kyc/start');
  });

  it('7. generates REGISTRATION_SUCCESS even if kycEmailsEnabled is false (lifecycle receipt)', async () => {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: false } });
    
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: false }
    });

    await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    const hook = auth.options.emailVerification?.afterEmailVerification;
    await hook!(user as any);

    const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);
    expect((events[0].payload as any).templateId).toBe('REGISTRATION_SUCCESS');
  });

  it('4. is idempotent and does not create duplicates on repeated verification hook calls', async () => {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: false } });
    
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    const hook = auth.options.emailVerification?.afterEmailVerification;
    await hook!(user as any);
    let events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);

    await hook!(user as any);
    events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);
  });

  it('generates ACCOUNT_APPROVED on admin approval', async () => {
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    const result = await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    
    await db.outboxEvent.deleteMany({});
    await approveMerchantAccount('system', result.merchantProfile.id);
    
    const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);
    expect((events[0].payload as any).templateId).toBe('ACCOUNT_APPROVED');
  });

  it('cannot generate ACCOUNT_APPROVED twice for the same approval', async () => {
    const result = await onboardMerchant({
      userId: user.id,
      businessName: 'Lifecycle Biz',
      phone: '1234' + randomUUID().substring(0, 6),
      address: 'Test Address'
    });
    await db.outboxEvent.deleteMany({});
    await approveMerchantAccount('system', result.merchantProfile.id);
    
    try {
      await approveMerchantAccount('system', result.merchantProfile.id);
    } catch (e: any) {
      expect(e.name).toBe('AdminMerchantStateConflictError');
    }
    
    const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
    expect(events.length).toBe(1);
  });

  describe('Session Hook Discrimination', () => {
    let hook: any;
    
    beforeEach(() => {
      hook = auth.options.databaseHooks?.session?.create?.after;
      expect(hook).toBeDefined();
    });

    it('1. registration session does not generate LOGIN_NOTIFICATION (delta < 60s)', async () => {
      const profile = await db.merchantProfile.create({data: {userId: user.id}}); await db.merchantSecuritySettings.create({ data: { merchantProfileId: profile.id, loginNotificationsEnabled: true } });
      
      const session = {
        id: randomUUID(),
        userId: user.id,
        createdAt: new Date(user.createdAt.getTime() + 1000) // 1 second after user
      };
      
      await hook!(session as any);
      
      const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
      expect(events.length).toBe(0);
    });

    it('5. normal later login generates LOGIN_NOTIFICATION when enabled', async () => {
      const profile = await db.merchantProfile.create({data: {userId: user.id}}); await db.merchantSecuritySettings.create({ data: { merchantProfileId: profile.id, loginNotificationsEnabled: true } });
      
      const session = {
        id: randomUUID(),
        userId: user.id,
        createdAt: new Date(user.createdAt.getTime() + 120000) // 2 minutes after user
      };
      
      await hook!(session as any);
      
      const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
      expect(events.length).toBe(1);
      expect((events[0].payload as any).templateId).toBe('LOGIN_NOTIFICATION');
    });

    it('6. disabled login notifications suppress LOGIN_NOTIFICATION', async () => {
      await db.notificationPreference.create({ data: { userId: user.id, loginEmailsEnabled: false } });
      
      const session = {
        id: randomUUID(),
        userId: user.id,
        createdAt: new Date(user.createdAt.getTime() + 120000) // genuine login but disabled
      };
      
      await hook!(session as any);
      
      const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
      expect(events.length).toBe(0);
    });

    it('suppresses LOGIN_NOTIFICATION if email is unverified even if later login', async () => {
      const profile = await db.merchantProfile.create({data: {userId: user.id}}); await db.merchantSecuritySettings.create({ data: { merchantProfileId: profile.id, loginNotificationsEnabled: true } });
      
      // make user unverified
      await db.user.update({ where: { id: user.id }, data: { emailVerified: false } });

      const session = {
        id: randomUUID(),
        userId: user.id,
        createdAt: new Date(user.createdAt.getTime() + 120000) // genuine login timing
      };
      
      await hook!(session as any);
      
      const events = await db.outboxEvent.findMany({ where: { referenceType: 'EMAIL_DISPATCH' } });
      expect(events.length).toBe(0);
    });
  });
});
