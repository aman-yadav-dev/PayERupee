import { describe, it, expect, vi, beforeEach } from "vitest";
import { processOutbox } from "@/modules/payout/application/outbox.processor";
import { PayoutReconciler } from "@/modules/payout/application/payout.reconciler";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider";
import * as providerFactory from "@/modules/provider/adapters/provider.factory";
import * as payoutService from "@/modules/payout/domain/payout.service";
import * as leaseService from "@/modules/system/domain/lease.service";
import { db } from "@/infrastructure/database/db";
import https from "https";
import { EventEmitter } from "events";
import { env } from "@/config/env";

vi.mock("@/infrastructure/database/db", () => ({
  db: {
    outboxEvent: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    payout: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    systemSetting: { findUnique: vi.fn() }
  }
}));

vi.mock("@/modules/system/domain/lease.service", () => ({
  acquireSystemLease: vi.fn(() => Promise.resolve(true)),
  releaseSystemLease: vi.fn(() => Promise.resolve())
}));

vi.mock("@/modules/payout/domain/payout.service", () => ({
  handlePayoutSuccess: vi.fn(),
  failPayout: vi.fn()
}));

vi.mock("@/config/env", () => ({
  env: {
    PROVIDER_NAME: "PAYMYQR",
    PAYMYQR_BASE_URL: "https://paymyqr.com",
    PAYMYQR_VENDOR_ID: "TEST",
    PAYMYQR_SECURITY_TOKEN: "TOK"
  }
}));

vi.mock("https", () => ({ 
  default: { request: vi.fn() },
  request: vi.fn() 
}));

function mockHttpsResponse(statusCode: number, bodyObj: any) {
  (https.request as any).mockImplementation((options: any, callback?: Function) => {
    const req = new EventEmitter() as any;
    req.write = vi.fn();
    req.end = vi.fn(() => {
      if (callback) {
        const res = new EventEmitter() as any;
        res.statusCode = statusCode;
        callback(res);
        res.emit("data", JSON.stringify(bodyObj));
        res.emit("end");
      }
    });
    req.destroy = vi.fn();
    return req;
  });
}

function mockHttpsTimeout() {
  (https.request as any).mockImplementation((options: any) => {
    const req = new EventEmitter() as any;
    req.write = vi.fn();
    req.end = vi.fn(() => {
      req.emit("timeout");
    });
    req.destroy = vi.fn();
    return req;
  });
}

describe("PayMyQR End-to-End Payout Flow Verification", () => {
  let provider: PayMyQrPayoutProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PayMyQrPayoutProvider();
    vi.spyOn(providerFactory, "getPayoutProvider").mockReturnValue(provider);
    
    // Default DB mocks
    (db.systemSetting.findUnique as any).mockResolvedValue({ reconciliationThresholdMins: 15 });
  });

  it("Full happy path: Outbox 202 -> Reconciler Processing -> Reconciler Completed", async () => {
    // 1. Outbox Sweeper
    (db.outboxEvent.findMany as any).mockResolvedValue([{ id: "evt1", referenceId: "payout1", referenceType: "PAYOUT_DISPATCH", attempts: 0 }]);
    (db.outboxEvent.updateMany as any).mockResolvedValue({ count: 1 });
    (db.payout.findUnique as any).mockResolvedValue({ id: "payout1", amount: 100, accountNumber: "user@upi", paymentMode: "UPI" });
    
    mockHttpsResponse(202, { transaction_id: "MOCK_TXN_001" });
    
    await processOutbox("worker1", provider);
    
    // Verify GET Request was made
    expect(https.request).toHaveBeenCalledTimes(1);
    const dispatchCallOpts = (https.request as any).mock.calls[0][0];
    expect(dispatchCallOpts.method).toBe("GET");
    expect(dispatchCallOpts.path).toContain("click_id=payout1"); // click_id matches payoutId!
    
    // Verify DB states updated correctly (202 = QUEUED)
    expect(db.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(db.payout.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ providerReference: "MOCK_TXN_001" }) }));

    // 2. Reconciler (Processing state)
    (db.payout.findMany as any).mockResolvedValue([{ id: "payout1", status: "PROCESSING", providerReference: "MOCK_TXN_001", merchantProfileId: "m1" }]);
    (db.outboxEvent.findUnique as any).mockResolvedValue({ status: "COMPLETED" }); // Not pending
    
    mockHttpsResponse(200, { status: "success", data: { transaction_id: "MOCK_TXN_001", click_id: "payout1", status: "processing" } });
    
    await PayoutReconciler.reconcileStalePayouts("worker1");
    
    // Verify POST status request made
    expect(https.request).toHaveBeenCalledTimes(2);
    const statusCall1Opts = (https.request as any).mock.calls[1][0];
    expect(statusCall1Opts.method).toBe("POST");
    
    // Processing does NOT trigger handlePayoutSuccess
    expect(payoutService.handlePayoutSuccess).not.toHaveBeenCalled();

    // 3. Reconciler (Completed state)
    mockHttpsResponse(200, { status: "success", data: { transaction_id: "MOCK_TXN_001", click_id: "payout1", status: "completed" } });
    
    await PayoutReconciler.reconcileStalePayouts("worker1");
    
    expect(https.request).toHaveBeenCalledTimes(3);
    // Finally triggers SUCCESS
    expect(payoutService.handlePayoutSuccess).toHaveBeenCalledWith("payout1", "m1", "MOCK_TXN_001");
  });

  it("Ambiguous flow: Dispatch Timeout -> EXHAUSTED -> Reconciler verifies same click_id", async () => {
    // 1. Dispatch fails with timeout
    (db.outboxEvent.findMany as any).mockResolvedValue([{ id: "evt2", referenceId: "payout2", referenceType: "PAYOUT_DISPATCH", attempts: 0 }]);
    (db.outboxEvent.updateMany as any).mockResolvedValue({ count: 1 });
    (db.payout.findUnique as any).mockResolvedValue({ id: "payout2", amount: 100, accountNumber: "user@upi", paymentMode: "UPI" });
    
    mockHttpsTimeout();
    
    await processOutbox("worker1", provider);
    
    expect(https.request).toHaveBeenCalledTimes(1);
    
    // Verified: Outbox marked EXHAUSTED, attempts bumped, NO new request
    expect(db.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({ 
      data: expect.objectContaining({ status: "EXHAUSTED", attempts: 1 }) 
    }));

    // 2. Reconciler polls it
    (db.payout.findMany as any).mockResolvedValue([{ id: "payout2", status: "PROCESSING", providerReference: null, merchantProfileId: "m1" }]);
    (db.outboxEvent.findUnique as any).mockResolvedValue({ status: "EXHAUSTED" });
    
    // Reconciler checks status using original click_id (payout2)
    mockHttpsResponse(200, { status: "success", data: [{ transaction_id: "MOCK_TXN_002", click_id: "payout2", status: "completed" }] });
    
    await PayoutReconciler.reconcileStalePayouts("worker1");
    
    expect(https.request).toHaveBeenCalledTimes(2);
    // Request must use original click_id
    const statusOpts = (https.request as any).mock.calls[1][0];
    expect(statusOpts.method).toBe("POST");
    
    // Provider resolved it as completed, trigger success
    expect(payoutService.handlePayoutSuccess).toHaveBeenCalledWith("payout2", "m1", "MOCK_TXN_002");
  });

  it("Full happy path: IMPS Flow with array status data", async () => {
    (db.outboxEvent.findMany as any).mockResolvedValue([{ id: "evt3", referenceId: "payout3", referenceType: "PAYOUT_DISPATCH", attempts: 0 }]);
    (db.outboxEvent.updateMany as any).mockResolvedValue({ count: 1 });
    (db.payout.findUnique as any).mockResolvedValue({ id: "payout3", amount: 100, accountNumber: "1234567890", ifscCode: "SBIN000", paymentMode: "IMPS", accountHolderName: "Name" });
    
    mockHttpsResponse(202, { transaction_id: "MOCK_TXN_IMPS" });
    
    await processOutbox("worker1", provider);
    
    const dispatchCallOpts = (https.request as any).mock.calls[0][0];
    expect(dispatchCallOpts.path).toContain("transfer_mode=imps");
    expect(dispatchCallOpts.path).toContain("bank_account=1234567890");
    expect(dispatchCallOpts.path).toContain("click_id=payout3");
    
    expect(db.outboxEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
    
    (db.payout.findMany as any).mockResolvedValue([{ id: "payout3", status: "PROCESSING", providerReference: "MOCK_TXN_IMPS", merchantProfileId: "m1" }]);
    (db.outboxEvent.findUnique as any).mockResolvedValue({ status: "COMPLETED" });
    
    // Status returns an array (as observed in live testing)
    mockHttpsResponse(200, { status: "success", count: 1, data: [{ transaction_id: "MOCK_TXN_IMPS", click_id: "payout3", status: "failed" }] });
    
    await PayoutReconciler.reconcileStalePayouts("worker1");
    
    expect(payoutService.failPayout).toHaveBeenCalledWith("payout3", "m1", "failed");
  });
});

