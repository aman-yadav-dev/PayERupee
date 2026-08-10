import { NextRequest } from "next/server";
import { PayoutWebhookController } from "@/modules/webhook/controllers/payout-webhook.controller";

export async function POST(req: NextRequest) {
  return PayoutWebhookController.handleWebhook(req);
}
