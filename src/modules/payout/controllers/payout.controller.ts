import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, UnauthorizedError } from "@/modules/auth/application/api-auth.service";
import { createPayout, DestinationBannedError, SystemConfigurationError, IllegalStateTransitionError, IdempotencyConflictError, PayoutValidationError } from "@/modules/payout/domain/payout.service";
import { dispatchPayout } from "@/modules/payout/application/payout.orchestrator";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { InsufficientFundsError } from "@/modules/wallet/domain/wallet.service";
import { z } from "zod";
import { logger } from "@/infrastructure/logger/logger";

export class PayoutController {
  static async create(req: NextRequest): Promise<NextResponse> {
    try {
      const serializePayout = (p: Record<string, unknown>) => ({
        id: p.id,
        idempotencyKey: p.idempotencyKey,
        amount: p.amount,
        fee: p.fee,
        tax: p.tax,
        totalDebitAmount: p.totalDebitAmount,
        status: p.status,
        paymentMode: p.paymentMode,
        merchantReference: p.merchantReference,
        failureReason: p.failureReason,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        accountNumber: p.accountNumber,
        ifscCode: p.ifscCode,
        accountHolderName: p.accountHolderName,
        vpa: p.vpa
      });

      const { merchantProfileId, environment } = await authenticateApiKey(req.headers.get("Authorization"));

      // 1b. Determine provider based on environment
      const provider = getPayoutProvider(environment);

      // 2. Parse Body first for security enforcer
      const idempotencyKey = req.headers.get('Idempotency-Key');
      if (!idempotencyKey || idempotencyKey.trim() === '') {
        return NextResponse.json({ success: false, error: 'Missing or blank Idempotency-Key header' }, { status: 400 });
      }
      
      const body = await req.json();

      // 3. Centralized Security Enforcement Boundary
      try {
        const { MerchantSecurityService } = await import("@/modules/merchant/application/merchant-security.service");
        await MerchantSecurityService.enforcePayoutSecurity(merchantProfileId, req, body);
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "SecurityBlockedError") {
          const sErr = err as Error & { code?: string; details?: unknown; detectedIp?: string; action?: unknown };
          return NextResponse.json({
            success: false,
            error: {
              code: sErr.code || "SECURITY_BLOCKED",
              message: sErr.message,
              details: sErr.details,
              detectedIp: sErr.detectedIp,
              action: sErr.action
            }
          }, { status: 403 });
        }
        throw err;
      }

      // 4. Create PENDING payout
      const { payout, isNew } = await createPayout(merchantProfileId, environment, idempotencyKey, body);

      if (!isNew) {
        // Idempotent duplicate: simply return the existing payout state immediately
        logger.info(`Idempotent duplicate request returned for payout ${payout.id}`);
        return NextResponse.json({ success: true, payout: serializePayout(payout) }, { status: 200 });
      }

      // 5. Orchestrate
      const finalPayout = await dispatchPayout(payout.id, merchantProfileId, environment, provider);

      return NextResponse.json({ success: true, payout: serializePayout(finalPayout) }, { status: 201 });
    } catch (error) {
      if (error instanceof DestinationBannedError || (error instanceof Error && error.name === "DestinationBannedError")) {
        const banErr = error as DestinationBannedError;
        return NextResponse.json({
          success: false,
          error: {
            code: "DESTINATION_BANNED",
            message: banErr.message,
            scope: banErr.banScope,
            reason: banErr.banReason,
            maskedDestination: banErr.maskedDestination,
          }
        }, { status: 403 });
      }
      if (error instanceof UnauthorizedError) {
        logger.error("Unauthorized payout attempt", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      if (error instanceof Error && error.name === "ForbiddenError") {
        logger.error("Forbidden payout attempt", error);
        const fbErr = error as Error & { code?: string; details?: unknown; action?: unknown };
        return NextResponse.json({
          success: false,
          error: {
            code: fbErr.code || "FORBIDDEN",
            message: fbErr.message,
            details: fbErr.details,
            action: fbErr.action
          }
        }, { status: 403 });
      }
      if (error instanceof z.ZodError) {
        logger.error("Validation failed", error.issues);
        return NextResponse.json({ success: false, error: "Validation failed", details: error.issues }, { status: 400 });
      }
      if (error instanceof InsufficientFundsError) {
        logger.error("Insufficient funds", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error instanceof SystemConfigurationError) {
        logger.error("System configuration error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 503 });
      }
              
      if (error instanceof PayoutValidationError) {
        logger.error("Payout validation error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      if (error instanceof IdempotencyConflictError) {
          logger.error("Idempotency conflict", error);
          return NextResponse.json({ success: false, error: error.message }, { status: 409 });
        }
        if (error instanceof IllegalStateTransitionError) {
        logger.error("Illegal state transition", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 409 });
      }
      if (error instanceof Error && error.message.startsWith("Unknown provider configuration")) {
        logger.error("Provider configuration error", error);
        return NextResponse.json({ success: false, error: "Service configuration error" }, { status: 503 });
      }
      const message = error instanceof Error ? error.message : "Internal Server Error";
      logger.error("Internal server error during payout API", message);
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }
}
