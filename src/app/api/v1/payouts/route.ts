import { NextRequest } from "next/server";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";

export async function POST(req: NextRequest) {
  return PayoutController.create(req);
}
