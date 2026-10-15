import { IPayoutProvider, ProviderDispatchResult, NormalizedWebhookEvent } from "@/modules/provider/core/provider.interface";
import { env } from "@/config/env";
import https from "https";
import { logger } from "@/infrastructure/logger/logger";

export class PayMyQrPayoutProvider implements IPayoutProvider {
  private getBaseUrl() {
    return env.PAYMYQR_BASE_URL || "https://paymyqr.com";
  }

  private redactError(message: string): string {
    const token = env.PAYMYQR_SECURITY_TOKEN;
    const vendor = env.PAYMYQR_VENDOR_ID;
    let redacted = message;
    if (token) redacted = redacted.split(token).join("[REDACTED_TOKEN]");
    if (vendor) redacted = redacted.split(vendor).join("[REDACTED_VENDOR]");
    return redacted;
  }


  private redactText(text: string, accountNumber: string | null = null, ifscCode: string | null = null, vpa: string | null = null): string {
    let redacted = this.redactError(text);
    if (accountNumber && accountNumber.length > 4) {
      redacted = redacted.split(accountNumber).join("[REDACTED_ACCOUNT]");
    }
    if (ifscCode) redacted = redacted.split(ifscCode).join("[REDACTED_IFSC]");
    if (vpa) redacted = redacted.split(vpa).join("[REDACTED_VPA]");
    return redacted;
  }

  private sanitizeObject(obj: any, accountNumber: string | null, ifscCode: string | null, vpa: string | null) {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "string") {
        obj[key] = this.redactText(obj[key], accountNumber, ifscCode, vpa);
      } else if (typeof obj[key] === "object") {
        this.sanitizeObject(obj[key], accountNumber, ifscCode, vpa);
      }
    }
  }

  private buildFailureDetails(
    httpStatus: number | null,
    parsedBody: any,
    rawBody: string,
    providerReference: string | null = null,
    accountNumber: string | null = null,
    ifscCode: string | null = null,
    vpa: string | null = null
  ) {
    let details: any = null;
    
    if (parsedBody && Object.keys(parsedBody).length > 0) {
       details = JSON.parse(JSON.stringify(parsedBody));
       this.sanitizeObject(details, accountNumber, ifscCode, vpa);
    } else if (rawBody) {
       details = this.redactText(rawBody, accountNumber, ifscCode, vpa);
    }

    return {
      provider: "PAYMYQR",
      httpStatus,
      errorCode: (parsedBody?.error_code || parsedBody?.code || parsedBody?.status) ? this.redactText(String(parsedBody?.error_code || parsedBody?.code || parsedBody?.status), accountNumber, ifscCode, vpa) : null,
      errorMessage: (parsedBody?.message || parsedBody?.user_message) ? this.redactText(String(parsedBody?.message || parsedBody?.user_message), accountNumber, ifscCode, vpa) : null,
      providerReference: providerReference ? this.redactText(String(providerReference), accountNumber, ifscCode, vpa) : null,
      details
    };
  }

  private httpRequest(options: https.RequestOptions, body?: string): Promise<{ statusCode: number, body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = "";
        res.on("data", (d) => (responseBody += d));
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 500, body: responseBody });
        });
      });

      req.on("error", (err) => {
        reject(new Error(this.redactError(err.message)));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  async dispatch(
    payoutId: string, // this is the original internal payout ID -> becomes click_id
    amount: string,
    accountNumber: string | null,
    ifscCode: string | null,
    mode: string,
    accountHolderName: string | null,
    beneficiaryPhone?: string | null,
    vpa?: string | null
  ): Promise<ProviderDispatchResult> {
    const modeLower = mode.toLowerCase();
    if (modeLower !== "upi" && modeLower !== "imps") {
      return { outcome: "REJECTED", failureReason: "PayMyQR only supports UPI or IMPS transfer mode" };
    }

    const baseUrl = this.getBaseUrl();
    const token = env.PAYMYQR_SECURITY_TOKEN || "";
    const vendor = env.PAYMYQR_VENDOR_ID || "";

    const searchParams = new URLSearchParams({
      vendor,
      amount: amount.toString(),
      click_id: payoutId,
      goal_id: "payout",
      remarks: "Payout",
      security_token: token
    });

    if (modeLower === "upi") {
      searchParams.append("transfer_mode", "upi");
      searchParams.append("upi", vpa || "");
    } else {
      searchParams.append("transfer_mode", "imps");
      searchParams.append("bank_account", accountNumber || "");
      searchParams.append("bank_ifsc", ifscCode || "");
      searchParams.append("beneficiary_name", accountHolderName || "");
    }

    const urlString = `${baseUrl}/transactions/batch?${searchParams.toString()}`;
    const url = new URL(urlString);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "GET",
      family: 4,
      timeout: 15000,
    };

    try {
      const res = await this.httpRequest(options);
      
      let parsed: any = {};
      try {
        parsed = JSON.parse(res.body);
      } catch (e) {
        // Ignore unparseable
      }

      if (res.statusCode === 202) {
        let txnId = parsed.transaction_id;
        if (parsed.data && parsed.data.transaction_id) txnId = parsed.data.transaction_id;
        
        return {
          outcome: "QUEUED",
          providerReference: txnId
        };
      }

      if (res.statusCode === 409) {
        // DUPLICATE DETECTED
        let existingTxnId = parsed.details?.existing_transaction_id;
        
        // Internal status reconciliation using the same click_id
        try {
          const statusRes = await this.status(payoutId, existingTxnId);
          return statusRes;
        } catch (e) {
          // If reconciliation fails, safely mark as ambiguous NETWORK_ERROR
          return { outcome: "NETWORK_ERROR", failureReason: this.redactError(e instanceof Error ? e.message : String(e)) };
        }
      }

      // Any other validation failures (4xx / 500 IP validation)
      if (parsed.status === "error" || (res.statusCode >= 400 && res.statusCode < 500)) {
         if (parsed.message === "IP validation failed") {
             const providerFailureDetails = this.buildFailureDetails(res.statusCode, parsed, res.body, null, accountNumber, ifscCode, vpa);
             logger.error("PayMyQR provider IP validation failed", providerFailureDetails);
             return { outcome: "REJECTED", failureReason: "IP validation failed", providerFailureDetails };
         }
         
         if (res.statusCode === 500 && !parsed.message) {
            // Ambiguous 500
            return { outcome: "NETWORK_ERROR", failureReason: "Provider 500 Error" };
         }
         
         const providerFailureDetails = this.buildFailureDetails(res.statusCode, parsed, res.body, null, accountNumber, ifscCode, vpa);
         logger.error("PayMyQR provider rejected payout", providerFailureDetails); 
         return { outcome: "REJECTED", failureReason: "Payment provider rejected the payout request", providerFailureDetails };
      }

      // 5xx network or ambiguous timeout
      return { outcome: "NETWORK_ERROR", failureReason: `Unknown response HTTP ${res.statusCode}` };
      
    } catch (e) {
      // e.message is already redacted in httpRequest
      return { outcome: "NETWORK_ERROR", failureReason: e instanceof Error ? e.message : "Network error" };
    }
  }

  async status(payoutId: string, providerReference?: string): Promise<ProviderDispatchResult> {
    const baseUrl = this.getBaseUrl();
    const token = env.PAYMYQR_SECURITY_TOKEN || "";
    const vendor = env.PAYMYQR_VENDOR_ID || "";

    const urlString = `${baseUrl}/transaction/status?vendor=${vendor}`;
    const url = new URL(urlString);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "POST",
      family: 4, // FORCED IPv4
      timeout: 15000,
      headers: {
        "Content-Type": "application/json"
      }
    };

    const bodyObj: any = { security_token: token };
    if (providerReference) {
      bodyObj.transaction_id = providerReference;
    } else {
      bodyObj.click_id = payoutId;
    }

    try {
      const res = await this.httpRequest(options, JSON.stringify(bodyObj));
      
      let parsed: any = {};
      try {
        parsed = JSON.parse(res.body);
      } catch (e) {
        return { outcome: "NETWORK_ERROR", failureReason: "Unparseable status response" };
      }

      if (res.statusCode === 200 && parsed.status === "success") {
        let txData = parsed.data;
        if (Array.isArray(txData)) {
          if (txData.length === 0) return { outcome: "NOT_FOUND", failureReason: "No transaction data returned" };
          txData = txData[0];
        }

        if (!txData) {
           return { outcome: "NOT_FOUND", failureReason: "Empty transaction data" };
        }

        const currentStatus = txData.status;
        const ref = txData.transaction_id;

        if (currentStatus === "completed") {
          return { outcome: "SUCCESS", providerReference: ref };
        } else if (currentStatus === "processing") {
          return { outcome: "QUEUED", providerReference: ref };
        } else if (currentStatus === "validation_failed" || currentStatus === "failed" || currentStatus === "cancelled") {
          const providerFailureDetails = this.buildFailureDetails(res.statusCode, parsed, res.body, ref);
          logger.error("PayMyQR provider failed payout status", providerFailureDetails); 
          return { outcome: "REJECTED", failureReason: "Payment provider failed to process the payout", providerReference: ref, providerFailureDetails };
        } else {
           return { outcome: "QUEUED", providerReference: ref };
        }
      }

      if (res.statusCode === 404) {
        return { outcome: "NOT_FOUND", failureReason: "Transaction not found at provider" };
      }

      return { outcome: "NETWORK_ERROR", failureReason: `Unexpected status code ${res.statusCode}` };

    } catch (e) {
      return { outcome: "NETWORK_ERROR", failureReason: e instanceof Error ? e.message : "Status check failed" };
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    return false;
  }

  parseWebhook(rawBody: string): NormalizedWebhookEvent {
    throw new Error("PayMyQR webhooks are not implemented.");
  }
}

