import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail, sendVerificationEmail, getTransporter, _resetTransporter } from "@/infrastructure/notifications/mailer";
import * as nodemailer from "nodemailer";

// Mock nodemailer
vi.mock("nodemailer", () => {
  const sendMailMock = vi.fn().mockResolvedValue(true);
  return {
    createTransport: vi.fn().mockReturnValue({
      sendMail: sendMailMock,
    }),
  };
});

// Mock the env configuration directly
vi.mock("@/config/env", () => ({
  env: {
    NODE_ENV: "test",
    SMTP_ENABLED: false, // boolean, not string
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    MAIL_FROM: "",
  },
}));

import { env } from "@/config/env";

describe("Mailer Abstraction and Templates", () => {
  let consoleSpy: any;
  let sendMailMock: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    _resetTransporter(); // reset cache!
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const transport = nodemailer.createTransport({});
    sendMailMock = transport.sendMail;
    vi.mocked(sendMailMock).mockClear();
    vi.mocked(nodemailer.createTransport).mockClear();
  });

  describe("Nodemailer Transport Configuration", () => {
    it("1. & 2. & 3. Configures Hostinger SMTP correctly", () => {
      (env as any).SMTP_HOST = "smtp.hostinger.com";
      (env as any).SMTP_PORT = 465;
      (env as any).SMTP_USER = "hello@payerupee.com";
      (env as any).SMTP_PASSWORD = "secret_password";

      const transporter = getTransporter();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        auth: {
          user: "hello@payerupee.com",
          pass: "secret_password",
        },
      });
    });
  });

  describe("sendVerificationEmail Template", () => {
    it("formats the email correctly and outputs expected dev logs when SMTP is disabled", async () => {
      (env as any).SMTP_ENABLED = false;

      await sendVerificationEmail({
        user: {
          id: "user_123",
          email: "test@example.com",
          name: "Test <Script>Merchant</Script>", // test XSS
        },
        url: "https://pay.erupee.com/verify?token=123&fake=<script>",
        token: "123",
      });

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((c: any) => c.join(" ")).join("\n");

      expect(calls).toContain("To: test@example.com");
      expect(calls).toContain("Subject: Verify your PayERupee email");
      expect(calls).toContain("https://pay.erupee.com/verify?token=123&fake=<script>");
      expect(calls).toContain("This verification link expires in 24 hours");
      expect(calls).toContain("Test <Script>Merchant</Script>");
    });
  });

  describe("Production vs Development Behavior", () => {
    it("8. Missing SMTP configuration fails safely", async () => {
      (env as any).SMTP_ENABLED = true;
      (env as any).SMTP_HOST = ""; // Missing configs

      await expect(
        sendEmail({ to: "a@b.com", subject: "Test", html: "H", text: "T" })
      ).rejects.toThrow("CRITICAL: Production SMTP configuration is missing");
    });

    it("9. SMTP errors do not expose credentials", async () => {
      (env as any).SMTP_ENABLED = true;
      (env as any).SMTP_HOST = "smtp.hostinger.com";
      (env as any).SMTP_PORT = 465;
      (env as any).SMTP_USER = "user123";
      (env as any).SMTP_PASSWORD = "secret_pass";

      // Simulate a generic SMTP failure
      vi.mocked(sendMailMock).mockRejectedValueOnce(new Error("Connection timeout"));

      let errMessage = "";
      try {
        await sendEmail({ to: "a@b.com", subject: "Test", html: "H", text: "T" });
      } catch (err: any) {
        errMessage = err.message;
      }

      expect(errMessage).toContain("Failed to dispatch transactional email via SMTP.");
      expect(errMessage).not.toContain("smtp.hostinger.com");
      expect(errMessage).not.toContain("user123");
      expect(errMessage).not.toContain("secret_pass");
    });

    it("Real SMTP Delivery format", async () => {
      (env as any).SMTP_ENABLED = true;
      (env as any).SMTP_HOST = "smtp.hostinger.com";
      (env as any).SMTP_PORT = 465;
      (env as any).SMTP_USER = "hello@payerupee.com";
      (env as any).SMTP_PASSWORD = "secret_password";
      (env as any).MAIL_FROM = '"PayERupee Team" <hello@payerupee.com>';

      await sendEmail({ to: "a@b.com", subject: "Test Subject", html: "<p>H</p>", text: "T" });

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const mailArgs = sendMailMock.mock.calls[0][0];

      // 4. Correct sender
      expect(mailArgs.from).toBe('"PayERupee Team" <hello@payerupee.com>');
      // 5. Correct recipient
      expect(mailArgs.to).toBe("a@b.com");
      // 6. Correct subject
      expect(mailArgs.subject).toBe("Test Subject");
      // 7. HTML + text payload
      expect(mailArgs.html).toBe("<p>H</p>");
      expect(mailArgs.text).toBe("T");
    });
  });
});
