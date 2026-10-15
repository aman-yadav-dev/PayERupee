import { env } from "@/config/env";
import * as nodemailer from "nodemailer";

export const EMAIL_VERIFICATION_EXPIRATION_SECONDS = 86400; // 24 hours

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailVerificationPayload {
  user: {
    id: string;
    email: string;
    name: string;
  };
  url: string;
  token: string;
}

let transporter: nodemailer.Transporter | null = null;

// Exported for test isolation
export function _resetTransporter() {
  transporter = null;
}

export function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error("CRITICAL: Production SMTP configuration is missing. Cannot dispatch transactional email.");
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

/**
 * Reusable PayERupee transactional email shell
 */
export function getEmailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PayERupee</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#1a1a1a;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f9fafb;width:100%;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <!-- Main Card -->
        <table width="100%" max-width="600" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);overflow:hidden;">
          <tr>
            <td style="padding:40px;">

              <!-- Header -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-bottom:1px solid #e5e7eb;padding-bottom:20px;margin-bottom:30px;">
                    <h1 style="font-size:24px;font-weight:700;color:#4f46e5;margin:0;letter-spacing:-0.5px;">PayERupee Solutions</h1>
                  </td>
                </tr>
              </table>

              <!-- Content -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-top:30px;font-size:15px;color:#374151;line-height:1.6;">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="100%" max-width="600" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;">
          <tr>
            <td align="center" style="padding-top:40px;font-size:13px;color:#9ca3af;line-height:1.5;">
              <p style="margin:0 0 10px 0;">Need help? Contact our support team at <a href="mailto:support@payerupee.in" style="color:#4f46e5;text-decoration:none;">support@payerupee.in</a></p>
              <p style="margin:0;">&copy; 2026 PayERupee Solutions. All rights reserved.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getTextShell(content: string): string {
  return `PayERupee Solutions\n=======================================================\n\n${content}\n\n---\nNeed help? Contact our support team at support@payerupee.in\n(c) 2026 PayERupee Solutions. All rights reserved.`;
}

export async function sendEmail(options: SendEmailOptions) {
  if (!env.SMTP_ENABLED) {
    // Explicitly development-only transport if real SMTP is not explicitly enabled
    console.log("\n=======================================================");
    console.log("🚀 [DEV MAILER] TRANSACTIONAL EMAIL DISPATCHED");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Text:\n${options.text}`);
    console.log("=======================================================\n");
    return;
  }

  const mailer = getTransporter();

  try {
    await mailer.sendMail({
      from: env.MAIL_FROM || `"PayERupee" <${env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  } catch (error: any) {
    // Fail safely without exposing credentials to the stack trace
    throw new Error("Failed to dispatch transactional email via SMTP.");
  }
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendVerificationEmail(payload: EmailVerificationPayload) {
  const expirationHours = Math.round(EMAIL_VERIFICATION_EXPIRATION_SECONDS / 3600);
  const safeName = escapeHtml(payload.user.name);
  // URL is safe since we control its domain and token generation, but encode it for HTML
  const safeUrl = escapeHtml(payload.url);

  const htmlContent = `
    <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
    <h2 style="margin:0 0 16px 0;color:#111827;font-size:20px;font-weight:700;">Verify your email address</h2>
    <p style="margin:0 0 24px 0;">Thanks for creating your PayERupee account.<br>Please verify your email address to continue.</p>

    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
      <tr>
        <td align="center" bgcolor="#4f46e5" style="border-radius:8px;">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#4f46e5;">Verify Email</a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;">This verification link expires in ${expirationHours} hours.</p>

    <div style="background-color:#f3f4f6;border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;font-weight:500;">If the button doesn't work, copy and paste this secure link:</p>
      <p style="margin:0;font-size:13px;color:#4f46e5;word-break:break-all;"><a href="${safeUrl}" style="color:#4f46e5;text-decoration:underline;">${safeUrl}</a></p>
    </div>

    <p style="margin:0;font-size:13px;color:#6b7280;"><strong>Security note:</strong> If you did not create this account, you can safely ignore this email.</p>
  `;

  const textContent = `Hello ${payload.user.name},

Verify your email address

Thanks for creating your PayERupee account.
Please verify your email address to continue by visiting the link below:

${payload.url}

This verification link expires in ${expirationHours} hours.

Security note:
If you did not create this account, you can safely ignore this email.`;

  await sendEmail({
    to: payload.user.email,
    subject: "Verify your PayERupee email",
    html: getEmailShell(htmlContent),
    text: getTextShell(textContent),
  });
}

export async function sendPasswordResetEmail(payload: EmailVerificationPayload) {
  const safeName = escapeHtml(payload.user.name);
  const safeUrl = escapeHtml(payload.url);

  const htmlContent = `
    <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
    <h2 style="margin:0 0 16px 0;color:#111827;font-size:20px;font-weight:700;">Reset your PayERupee password</h2>
    <p style="margin:0 0 24px 0;">We received a request to reset the password for your PayERupee account.</p>

    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
      <tr>
        <td align="center" bgcolor="#4f46e5" style="border-radius:8px;">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#4f46e5;">Reset Password</a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;">This link expires in 1 hour.</p>

    <div style="background-color:#f3f4f6;border-radius:6px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;font-weight:500;">If the button doesn't work, copy and paste this secure link:</p>
      <p style="margin:0;font-size:13px;color:#4f46e5;word-break:break-all;"><a href="${safeUrl}" style="color:#4f46e5;text-decoration:underline;">${safeUrl}</a></p>
    </div>

    <p style="margin:0;font-size:13px;color:#6b7280;"><strong>Security note:</strong> If you did not request this reset, you can safely ignore this email. Your password will remain unchanged.</p>
  `;

  const textContent = `Hello ${payload.user.name},

Reset your PayERupee password

We received a request to reset the password for your PayERupee account.
You can reset your password by visiting the link below:

${payload.url}

This link expires in 1 hour.

Security note:
If you did not request this reset, you can safely ignore this email. Your password will remain unchanged.`;

  await sendEmail({
    to: payload.user.email,
    subject: "Reset your PayERupee password",
    html: getEmailShell(htmlContent),
    text: getTextShell(textContent),
  });
}
import { z } from "zod";

export const emailOutboxPayloadSchema = z.discriminatedUnion("templateId", [
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("GENERIC_NOTIFICATION"),
    templateVariables: z.object({
      message: z.string()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("REGISTRATION_SUCCESS"),
    templateVariables: z.object({
      name: z.string(),
      ctaLink: z.string()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("KYC_SUBMITTED"),
    templateVariables: z.object({
      name: z.string(),
      isResubmission: z.boolean()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("KYC_REJECTED"),
    templateVariables: z.object({
      name: z.string(),
      reason: z.string(),
      ctaLink: z.string()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("KYC_APPROVED"),
    templateVariables: z.object({
      name: z.string()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("ACCOUNT_APPROVED"),
    templateVariables: z.object({
      name: z.string(),
      ctaLink: z.string()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("LOGIN_NOTIFICATION"),
    templateVariables: z.object({
      name: z.string(),
      time: z.string()
    })
  }),
  z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    templateId: z.literal("TEST_TEMPLATE"),
    templateVariables: z.object({}).optional()
  })
]);

export type EmailOutboxPayload = z.infer<typeof emailOutboxPayloadSchema>;

function getButtonHtml(label: string, url: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;margin-bottom:24px;">
      <tr>
        <td align="center" bgcolor="#4f46e5" style="border-radius:8px;">
          <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#4f46e5;">${label}</a>
        </td>
      </tr>
    </table>
  `;
}

export async function dispatchOutboxEmail(payload: EmailOutboxPayload) {
  let htmlContent = "";
  let textContent = "";

  if (payload.templateId === "GENERIC_NOTIFICATION") {
    const safeMessage = escapeHtml(payload.templateVariables.message);
    htmlContent = '<p style="margin:0;font-size:15px;color:#374151;">' + safeMessage + '</p>';
    textContent = payload.templateVariables.message;
  } else if (payload.templateId === "REGISTRATION_SUCCESS") {
    const safeName = escapeHtml(payload.templateVariables.name);
    const safeLink = escapeHtml(payload.templateVariables.ctaLink);
    htmlContent = `
      <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Welcome to PayERupee! Your initial onboarding is complete.</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Please complete your KYC application to activate your account.</p>
      ${getButtonHtml("Complete KYC", safeLink)}
    `;
    textContent = `Hello ${payload.templateVariables.name},

Welcome to PayERupee! Your initial onboarding is complete.
Please complete your KYC application to activate your account.

Complete KYC: ${payload.templateVariables.ctaLink}`;
  } else if (payload.templateId === "KYC_SUBMITTED") {
    const safeName = escapeHtml(payload.templateVariables.name);
    const subType = payload.templateVariables.isResubmission ? "resubmitted" : "submitted";
    htmlContent = `
      <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Your KYC application has been ${subType} and is currently under review. Please note this does not imply approval.</p>
    `;
    textContent = `Hello ${payload.templateVariables.name},

Your KYC application has been ${subType} and is currently under review. Please note this does not imply approval.`;
  } else if (payload.templateId === "KYC_REJECTED") {
    const safeName = escapeHtml(payload.templateVariables.name);
    const safeReason = escapeHtml(payload.templateVariables.reason);
    const safeLink = escapeHtml(payload.templateVariables.ctaLink);
    htmlContent = `
      <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Your KYC application has been rejected.</p>
      <div style="background-color:#fee2e2;border-radius:6px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#991b1b;"><strong>Reason:</strong> ${safeReason}</p>
      </div>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Please review the reason above and resubmit your application.</p>
      ${getButtonHtml("Resubmit KYC", safeLink)}
    `;
    textContent = `Hello ${payload.templateVariables.name},

Your KYC application has been rejected.

Reason: ${payload.templateVariables.reason}

Resubmit KYC: ${payload.templateVariables.ctaLink}`;
  } else if (payload.templateId === "KYC_APPROVED") {
    const safeName = escapeHtml(payload.templateVariables.name);
    htmlContent = `
      <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Your KYC application has been approved.</p>
    `;
    textContent = `Hello ${payload.templateVariables.name},

Your KYC application has been approved.`;
  } else if (payload.templateId === "ACCOUNT_APPROVED") {
    const safeName = escapeHtml(payload.templateVariables.name);
    const safeLink = escapeHtml(payload.templateVariables.ctaLink);
    htmlContent = `
      <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">Your PayERupee account is now active!</p>
      ${getButtonHtml("Go to Dashboard", safeLink)}
    `;
    textContent = `Hello ${payload.templateVariables.name},

Your PayERupee account is now active!

Go to Dashboard: ${payload.templateVariables.ctaLink}`;
  } else if (payload.templateId === "LOGIN_NOTIFICATION") {
    const safeName = escapeHtml(payload.templateVariables.name);
    const safeTime = escapeHtml(payload.templateVariables.time);
    const resetUrl = escapeHtml(env.BETTER_AUTH_URL + "/forgot-password");
    htmlContent = `
      <p style="margin:0 0 16px 0;color:#111827;font-weight:600;font-size:16px;">Hello ${safeName},</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">We noticed a new login to your PayERupee account on <strong>${safeTime}</strong>.</p>
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;">If this wasn't you, please reset your password immediately to secure your account.</p>
      ${getButtonHtml("Reset Password", resetUrl)}
    `;
    textContent = `Hello ${payload.templateVariables.name},

We noticed a new login to your PayERupee account on ${payload.templateVariables.time}.

If this wasn't you, please reset your password immediately to secure your account:
${env.BETTER_AUTH_URL}/forgot-password`;
  } else if (payload.templateId === "TEST_TEMPLATE") {
    htmlContent = "<p>Test Email</p>";
    textContent = "Test Email";
  } else {
    throw new Error("Unsupported templateId");
  }

  await sendEmail({
    to: payload.to,
    subject: payload.subject,
    html: getEmailShell(htmlContent),
    text: getTextShell(textContent),
  });
}
