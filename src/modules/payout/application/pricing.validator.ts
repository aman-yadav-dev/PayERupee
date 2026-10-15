
import { db } from "../../../infrastructure/database/db";
import { PaymentMode } from "@prisma/client";
import { Prisma } from "@prisma/client";


export class PricingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingConfigurationError";
  }
}

export async function validatePricingConfiguration() {
  const settings = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } }); if (!settings) throw new PricingConfigurationError("GLOBAL_SETTINGS missing");
  if (settings.minPayoutAmount.toNumber() !== 1) {
    throw new PricingConfigurationError("GLOBAL_SETTINGS minPayoutAmount must be 1");
  }
  if (settings.maxPayoutAmount.toNumber() !== 10000000) {
    throw new PricingConfigurationError("GLOBAL_SETTINGS maxPayoutAmount must be 10000000");
  }
  if (settings.taxPercentage.toNumber() !== 18) {
    throw new PricingConfigurationError("GLOBAL_SETTINGS taxPercentage must be 18");
  }

  const activeRules = await db.payoutFeeRule.findMany({
    where: { isActive: true },
    orderBy: { minAmount: "asc" }
  });

  if (activeRules.length !== 6) {
    throw new PricingConfigurationError(`Expected exactly 6 active rules, found ${activeRules.length}`);
  }

  const modes: PaymentMode[] = [PaymentMode.UPI, PaymentMode.IMPS];
  for (const rule of activeRules) {
    if (!modes.includes(rule.paymentMode)) {
      throw new PricingConfigurationError(`Unsupported payment mode in active rules: ${rule.paymentMode}`);
    }
  }

  const upiRules = activeRules.filter(r => r.paymentMode === PaymentMode.UPI);
  const impsRules = activeRules.filter(r => r.paymentMode === PaymentMode.IMPS);

  if (upiRules.length !== 3) throw new PricingConfigurationError("Expected exactly 3 active UPI rules");
  if (impsRules.length !== 3) throw new PricingConfigurationError("Expected exactly 3 active IMPS rules");

  const expectedUpi = [
    { min: 1, max: 1000, fee: 2.50 },
    { min: 1000.01, max: 10000, fee: 10.45 },
    { min: 10000.01, max: 10000000, fee: 20.80 },
  ];

  const expectedImps = [
    { min: 1, max: 1000, fee: 6.00 },
    { min: 1000.01, max: 10000, fee: 10.45 },
    { min: 10000.01, max: 10000000, fee: 20.80 },
  ];

  const checkOverlapAndExact = (rules: typeof activeRules, expected: typeof expectedUpi, mode: string) => {
    let lastMax = new Prisma.Decimal(-1);
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.minAmount.lte(lastMax)) {
        throw new PricingConfigurationError(`Overlapping or duplicate rules detected for ${mode}: ${rule.minAmount} <= ${lastMax}`);
      }
      const exp = expected[i];
      if (rule.minAmount.toNumber() !== exp.min || rule.maxAmount.toNumber() !== exp.max || rule.fee.toNumber() !== exp.fee) {
        throw new PricingConfigurationError(`Pricing rule mismatch for ${mode}. Expected min ${exp.min}, max ${exp.max}, fee ${exp.fee}. Got min ${rule.minAmount}, max ${rule.maxAmount}, fee ${rule.fee}`);
      }
      lastMax = rule.maxAmount;
    }
  };

  checkOverlapAndExact(upiRules, expectedUpi, "UPI");
  checkOverlapAndExact(impsRules, expectedImps, "IMPS");
  
  return true;
}

