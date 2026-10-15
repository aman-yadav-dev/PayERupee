import { logger } from "@/infrastructure/logger/logger";
import { IPayoutProvider, ProviderDispatchResult, NormalizedWebhookEvent } from "@/modules/provider/core/provider.interface";
import { env } from "@/config/env";
import crypto from "crypto";

export class CashfreePayoutProvider implements IPayoutProvider {
  private getBaseUrl() {
    return env.CASHFREE_ENVIRONMENT === "PRODUCTION"
      ? "https://payout-api.cashfree.com/payout"
      : "https://sandbox.cashfree.com/payout";
  }

  private getHeaders() {
    return {
      "Content-Type": "application/json",
      "x-client-id": env.CASHFREE_CLIENT_ID || "",
      "x-client-secret": env.CASHFREE_CLIENT_SECRET || "",
      "x-api-version": "2024-01-01",
    };
  }

  async dispatch(
    payoutId: string,
    amount: string,
    accountNumber: string | null,
    ifscCode: string | null,
    mode: string,
    accountHolderName: string | null,
    beneficiaryPhone?: string | null,
    vpa?: string | null
  ): Promise<ProviderDispatchResult> {
    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();

    // 1. Generate a deterministic beneficiary ID
    const beneId = crypto
      .createHash("md5")
      .update(`${accountNumber || ""}_${ifscCode || ""}`)
      .digest("hex")
      .substring(0, 30);

    // 2. Add Beneficiary (Stateless)
    try {
      const addBeneRes = await fetch(`${baseUrl}/beneficiary`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          beneId,
          name: accountHolderName || "Unknown",
          email: "merchant@payerupee.in",
          phone: beneficiaryPhone || "9999999999",
          bankAccount: accountNumber,
          ifsc: ifscCode,
          address1: "Not Provided",
          city: "Not Provided",
          state: "Not Provided",
          pincode: "000000",
        }),
      });

      if (!addBeneRes.ok) {
        const errBody = await addBeneRes.json().catch(() => ({}));
        // If it already exists, we can proceed. Otherwise, fail.
        if (errBody.code !== "BENEFICIARY_ALREADY_EXISTS" && errBody.message !== "Beneficiary already exists") {
          logger.error("Cashfree Add Beneficiary Failed", addBeneRes.status, errBody);
          // If 5xx or rate limit/auth, it's a network/system error, not a definitive rejection of the bank account
          if (addBeneRes.status >= 500 || [401, 403, 429].includes(addBeneRes.status)) {
            return { outcome: "NETWORK_ERROR", failureReason: "System error adding beneficiary" };
          }
          return {
            outcome: "REJECTED",
            failureReason: errBody.message || "Failed to add beneficiary",
          };
        }
      }
    } catch (e) {
      logger.error("Cashfree Add Beneficiary Network Error", e);
      return { outcome: "NETWORK_ERROR", failureReason: "Network error adding beneficiary" };
    }

    // 3. Initiate Transfer
    try {
      const transferRes = await fetch(`${baseUrl}/transfers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          transfer_id: payoutId,
          transfer_amount: parseFloat(amount),
          transfer_currency: "INR",
          transfer_mode: mode.toLowerCase() === "upi" ? "upi" : mode.toLowerCase(),
          beneficiary_details: {
            beneficiary_id: beneId,
          },
        }),
      });

      const data = await transferRes.json().catch(() => ({}));

      if (!transferRes.ok) {
        logger.error("Cashfree Transfer Failed", transferRes.status, data);
        
        // 5xx or gateway timeouts are ambiguous -> TIMEOUT/NETWORK_ERROR
        if (transferRes.status >= 500) {
          return { outcome: "TIMEOUT", failureReason: "Provider server error" };
        }
        // Auth/Rate Limits -> NETWORK_ERROR
        if ([401, 403, 429].includes(transferRes.status)) {
          return { outcome: "NETWORK_ERROR", failureReason: "Provider auth or rate limit error" };
        }

        // 4xx validation/business logic errors are definitive rejections
        return {
          outcome: "REJECTED",
          failureReason: data.message || "Transfer rejected by provider",
        };
      }

      // Transfer accepted for processing
      return {
        outcome: "QUEUED",
        providerReference: data.reference_id?.toString() || payoutId,
      };
    } catch (e) {
      logger.error("Cashfree Transfer Network Error", e);
      return { outcome: "NETWORK_ERROR", failureReason: "Network error initiating transfer" };
    }
  }

  async status(payoutId: string, providerReference?: string): Promise<ProviderDispatchResult> {
    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();

    try {
      const res = await fetch(`${baseUrl}/transfers/${payoutId}`, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        if (res.status === 404) {
          return { outcome: "NOT_FOUND", failureReason: "Transfer not found at provider" };
        }
        return { outcome: "NETWORK_ERROR", failureReason: "Status check failed" };
      }

      const data = await res.json();
      const status = data.status; // e.g. "SUCCESS", "FAILED", "PENDING", "REVERSED"

      if (status === "SUCCESS") {
        return { outcome: "SUCCESS", providerReference: data.reference_id?.toString() };
      } else if (status === "FAILED" || status === "REVERSED") {
        return { outcome: "REJECTED", failureReason: data.reason || "Transfer failed", providerReference: data.reference_id?.toString() };
      } else {
        return { outcome: "QUEUED", providerReference: data.reference_id?.toString() };
      }
    } catch (e) {
      return { outcome: "NETWORK_ERROR", failureReason: "Network error checking status" };
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    try {
      const secret = env.CASHFREE_WEBHOOK_SECRET || "default_test_secret";
      const signature = headers["x-webhook-signature"];
      const timestamp = headers["x-webhook-timestamp"];

      if (!signature || !timestamp) return false;

      // Check timestamp freshness (max 5 minutes = 300,000 ms)
      const webhookTime = parseInt(timestamp, 10);
      if (isNaN(webhookTime)) return false;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - webhookTime) > 300) {
        return false;
      }

      const signatureData = timestamp + rawBody;
      const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(signatureData)
        .digest("base64");

      const signatureBuffer = Buffer.from(signature);
      const computedBuffer = Buffer.from(computedSignature);

      if (signatureBuffer.length !== computedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
    } catch (e) {
      return false;
    }
  }

  parseWebhook(rawBody: string): NormalizedWebhookEvent {
    const body = JSON.parse(rawBody);
    
    // Cashfree Payouts webhook structure typically varies by event type
    // Example: { type: "TRANSFER_SUCCESS", data: { transfer: { reference_id, transfer_id, status } } }
    
    const event = body.type || body.event;
    const transfer = body.data?.transfer || body.transfer;

    if (!transfer) {
      throw new Error("Invalid webhook payload: missing transfer details");
    }

    let status: "SUCCESS" | "FAILED" | "REVERSED";
    if (event === "TRANSFER_SUCCESS") {
      status = "SUCCESS";
    } else if (event === "TRANSFER_FAILED") {
      status = "FAILED";
    } else if (event === "TRANSFER_REVERSED") {
      status = "REVERSED";
    } else {
      throw new Error(`Unhandled event type: ${event}`);
    }

    if (!transfer.transfer_id) {
      throw new Error("Invalid webhook payload: missing transfer_id");
    }

    return {
      payoutId: transfer.transfer_id.toString(),
      providerReference: transfer.reference_id?.toString(),
      status,
      reason: transfer.reason,
    };
  }
}
