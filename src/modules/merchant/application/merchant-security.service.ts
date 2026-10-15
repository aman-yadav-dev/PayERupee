import { db } from "@/infrastructure/database/db";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { logger } from "@/infrastructure/logger/logger";
import { Decimal } from "decimal.js";
import { Prisma, SecurityEventType, SecuritySeverity, ActivityType } from "@prisma/client";
import * as ipaddr from "ipaddr.js";
import { sendEmail, getEmailShell, getTextShell } from "@/infrastructure/notifications/mailer";

export class SecurityBlockedError extends Error {
  public code?: string;
  public details?: string;
  public detectedIp?: string;
  public action?: string;

  constructor(message: string, options?: { code?: string, details?: string, detectedIp?: string, action?: string }) {
    super(message);
    this.name = "SecurityBlockedError";
    this.code = options?.code;
    this.details = options?.details;
    this.detectedIp = options?.detectedIp;
    this.action = options?.action;
  }
}

export class MerchantSecurityService {
  static maskIdentifier(type: string, value: string): string {
    if (!value) return "Unknown";
    if (type === "UPI" && value.includes("@")) {
      const [name, domain] = value.split("@");
      return name.length > 2 ? `${name.slice(0, 2)}***@${domain}` : `***@${domain}`;
    } else if (type === "BANK_ACCOUNT" && value.length > 4) {
      return `******${value.slice(-4)}`;
    }
    return value;
  }

  static hashIdentifier(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
  /**
   * Extracts IP properly avoiding spoofable headers unless behind proxy.
   * If on Vercel/Next.js properly configured, req.ip is the source.
   */
  static extractClientIp(req: NextRequest): string {
    // 1. Provided by secure ingress (e.g. Vercel)
    if ((req as any).ip) {
      return (req as any).ip;
    }

    // 2. Only trust headers if explicitly configured for a trusted proxy
    if (process.env.TRUST_FORWARDED_HEADERS === "true") {
      const forwardedFor = req.headers.get("x-forwarded-for");
      if (forwardedFor) {
        return forwardedFor.split(",")[0].trim().split(":")[0];
      }
      const realIp = req.headers.get("x-real-ip");
      if (realIp) {
        return realIp.split(":")[0];
      }
    }

    // 3. Unsafe/unknown - we do not blindly trust headers
    return "127.0.0.1";
  }

  static validateIpAgainstWhitelist(ip: string, allowedIps: string[]): boolean {
    if (!allowedIps || allowedIps.length === 0) return false;

    let parsedIp: ipaddr.IPv4 | ipaddr.IPv6;
    try {
      parsedIp = ipaddr.parse(ip);
      // Map IPv4-mapped IPv6 to IPv4 (e.g., ::ffff:192.168.1.1 -> 192.168.1.1)
      if (parsedIp.kind() === 'ipv6' && (parsedIp as ipaddr.IPv6).isIPv4MappedAddress()) {
        parsedIp = (parsedIp as ipaddr.IPv6).toIPv4Address();
      }
    } catch (err) {
      return false; // Malformed IP
    }

    for (const allowed of allowedIps) {
      try {
        if (allowed.includes("/")) {
          // CIDR
          const cidr = ipaddr.parseCIDR(allowed);
          // @ts-ignore (ipaddr.js matching is a bit weird with types sometimes but match takes cidr)
          if (parsedIp.kind() === cidr[0].kind() && parsedIp.match(cidr)) {
            return true;
          }
        } else {
          // Exact IP
          let parsedAllowed = ipaddr.parse(allowed);
          if (parsedAllowed.kind() === 'ipv6' && (parsedAllowed as ipaddr.IPv6).isIPv4MappedAddress()) {
            parsedAllowed = (parsedAllowed as ipaddr.IPv6).toIPv4Address();
          }
          if (parsedIp.kind() === parsedAllowed.kind() && parsedIp.toString() === parsedAllowed.toString()) {
            return true;
          }
        }
      } catch (err) {
        // Ignore invalid entries in DB
      }
    }
    return false;
  }

  static async enforcePayoutSecurity(merchantProfileId: string, req: NextRequest, body: any): Promise<void> {
    const settings = await db.merchantSecuritySettings.findUnique({
      where: { merchantProfileId }
    });

    if (!settings) return; // No settings configured yet, fail-open (default insecure/lenient)

    const ip = this.extractClientIp(req);

    // 1. IP Whitelist
    if (settings.ipWhitelistEnabled) {
      if (!this.validateIpAgainstWhitelist(ip, settings.allowedIps)) {
        await this.logEvent({
          merchantProfileId,
          eventType: "IP_BLOCKED",
          severity: "HIGH",
          description: `API request blocked from non-whitelisted IP: ${ip}`,
          ipAddress: ip
        });
        
        if (!settings.allowedIps || settings.allowedIps.length === 0) {
          throw new SecurityBlockedError("IP validation failed.", {
            code: "IP_WHITELIST_EMPTY",
            details: "Your IP whitelist is enabled but no IPs are configured. All requests are currently blocked.",
            detectedIp: ip,
            action: "Add this IP address to your Security → IP Whitelist, or disable IP whitelisting."
          });
        } else {
          throw new SecurityBlockedError("IP validation failed.", {
            code: "IP_NOT_WHITELISTED",
            details: "The request IP address is not present in your whitelist.",
            detectedIp: ip,
            action: "Add this IP address to your Security → IP Whitelist."
          });
        }
      }
    }

    // 2. Maximum Amount Limit
    if (settings.maxApiPayoutEnabled && body && body.amount) {
      const amountDec = new Decimal(body.amount);
      const maxDec = new Decimal(settings.maxApiPayoutAmount.toString());
      if (amountDec.gt(maxDec)) {
        await this.logEvent({
          merchantProfileId,
          eventType: "API_AMOUNT_LIMIT_EXCEEDED",
          severity: "MEDIUM",
          description: `API payout amount ₹${amountDec.toFixed(2)} exceeded limit ₹${maxDec.toFixed(2)}.`,
          ipAddress: ip,
          metadata: { requestedAmount: amountDec.toNumber(), maxAmount: maxDec.toNumber() }
        });
        throw new SecurityBlockedError("API payout amount limit exceeded.", {
          code: "API_AMOUNT_LIMIT_EXCEEDED",
          details: `The requested amount exceeds your configured maximum API payout limit (${maxDec.toFixed(2)}).`,
          action: "Increase the Maximum API Payout limit in your Security settings, or reduce the payout amount."
        });
      }
    }

    // 3. Suspicious Activity (Alerting Only, Not Blocking)
    if (settings.suspiciousAlertsEnabled) {
      await this.monitorSuspiciousActivity(settings, merchantProfileId, ip, body);
    }
  }

  static async monitorSuspiciousActivity(settings: any, merchantProfileId: string, ip: string, body: any): Promise<void> {
    const windowStart = new Date(Date.now() - settings.suspiciousWindowSeconds * 1000);

    const checkThreshold = async (type: ActivityType, rawFingerprint: string) => {
      const dbHash = MerchantSecurityService.hashIdentifier(rawFingerprint);
      const masked = MerchantSecurityService.maskIdentifier(type, rawFingerprint);

      await db.suspiciousActivityLog.create({
        data: {
          merchantProfileId,
          activityType: type,
          fingerprint: dbHash
        }
      });

      const count = await db.suspiciousActivityLog.count({
        where: {
          merchantProfileId,
          activityType: type,
          fingerprint: dbHash,
          createdAt: { gte: windowStart }
        }
      });

      if (count >= settings.suspiciousThreshold) {
        // Trigger alert! Check cooldown first
        const cooldownStart = new Date(Date.now() - settings.suspiciousAlertCooldown * 1000);
        
        // Find if we already triggered an event for this type + fingerprint recently
        const recentAlert = await db.securityEvent.findFirst({
          where: {
            merchantProfileId,
            eventType: type === "IP" ? "SUSPICIOUS_IP_ACTIVITY" : type === "UPI" ? "SUSPICIOUS_UPI_ACTIVITY" : "SUSPICIOUS_BANK_ACCOUNT_ACTIVITY",
            fingerprint: masked,
            createdAt: { gte: cooldownStart }
          }
        });

        if (!recentAlert) {
          const eventType = type === "IP" ? "SUSPICIOUS_IP_ACTIVITY" : type === "UPI" ? "SUSPICIOUS_UPI_ACTIVITY" : "SUSPICIOUS_BANK_ACCOUNT_ACTIVITY";
          const desc = `Suspicious activity detected: ${count} requests for same ${type.replace("_", " ").toLowerCase()} within ${settings.suspiciousWindowSeconds} seconds.`;
          
          await this.logEvent({
            merchantProfileId,
            eventType,
            severity: "HIGH",
            description: desc,
            ipAddress: ip,
            fingerprint: masked
          });

          if (settings.suspiciousEmailEnabled) {
            await this.sendSuspiciousEmail(merchantProfileId, desc, type, masked);
          }
        }
      }
    };

    if (settings.suspiciousIpEnabled && ip) {
      await checkThreshold("IP", ip);
    }

    if (settings.suspiciousUpiEnabled && body?.paymentMode === "UPI" && body?.vpa) {
      await checkThreshold("UPI", body.vpa);
    }

    if (settings.suspiciousBankAccountEnabled && body?.paymentMode !== "UPI" && body?.accountNumber) {
      await checkThreshold("BANK_ACCOUNT", body.accountNumber);
    }
  }

  static async logEvent(data: {
    merchantProfileId: string;
    eventType: SecurityEventType;
    severity: SecuritySeverity;
    description: string;
    ipAddress?: string;
    fingerprint?: string;
    metadata?: any;
  }) {
    await db.securityEvent.create({
      data: {
        merchantProfileId: data.merchantProfileId,
        eventType: data.eventType,
        severity: data.severity,
        description: data.description,
        ipAddress: data.ipAddress,
        fingerprint: data.fingerprint,
        metadata: data.metadata || Prisma.JsonNull
      }
    });
  }

  static async sendSuspiciousEmail(merchantProfileId: string, description: string, type: string, maskedFingerprint: string) {
    const merchant = await db.merchantProfile.findUnique({
      where: { id: merchantProfileId },
      include: { user: true }
    });

    if (!merchant || !merchant.user.email) return;

    const htmlContent = `
      <p>Hello ${merchant.businessName || merchant.user.name},</p>
      <p>We detected unusual activity on your API:</p>
      <p><strong>${description}</strong></p>
      <p>Identifier: ${maskedFingerprint}</p>
      <p>If this was not you, please review your security settings and API keys immediately.</p>
    `;

    const textContent = `Unusual Activity Detected: ${description}. Identifier: ${maskedFingerprint}`;

    await sendEmail({
      to: merchant.user.email,
      subject: "Action Required: Suspicious API Activity Detected",
      html: getEmailShell(htmlContent),
      text: getTextShell(textContent)
    });
  }

  static async notifyNewLogin(userId: string, req: NextRequest) {
    const profile = await db.merchantProfile.findUnique({ where: { userId }, include: { user: true, merchantSecuritySettings: true } });
    if (!profile || !profile.merchantSecuritySettings?.loginNotificationsEnabled || !profile.user.email) return;

    const ip = this.extractClientIp(req);
    const userAgent = req.headers.get("user-agent") || "Unknown Device";

    await this.logEvent({
      merchantProfileId: profile.id,
      eventType: "NEW_LOGIN",
      severity: "LOW",
      description: "Successful new login.",
      ipAddress: ip
    });

    const htmlContent = `
      <p>Hello ${profile.user.name},</p>
      <p>A new login was detected on your account.</p>
      <ul>
        <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
        <li><strong>IP Address:</strong> ${ip}</li>
        <li><strong>Device/Browser:</strong> ${userAgent}</li>
      </ul>
      <p>If this was you, no further action is required.</p>
      <p>If this wasn't you, please reset your password immediately.</p>
    `;

    const textContent = `New login detected from IP ${ip} using ${userAgent}.`;

    await sendEmail({
      to: profile.user.email,
      subject: "Security Alert: New Login Detected",
      html: getEmailShell(htmlContent),
      text: getTextShell(textContent)
    });
  }
}
