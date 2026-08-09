import { Prisma } from "@prisma/client";
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/**
 * Ensures a value is a Prisma Decimal.
 * Throws if the value cannot be parsed as a valid Decimal.
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  try {
    return new Decimal(value);
  } catch (error) {
    throw new Error(`Invalid decimal value: ${value}`);
  }
}

/**
 * Asserts that a Decimal is strictly greater than zero.
 */
export function assertPositive(value: Decimal, name = "Value"): void {
  if (value.lte(0)) {
    throw new Error(`${name} must be strictly greater than zero.`);
  }
}

/**
 * Asserts that a Decimal is greater than or equal to zero.
 */
export function assertNonNegative(value: Decimal, name = "Value"): void {
  if (value.lt(0)) {
    throw new Error(`${name} must be greater than or equal to zero.`);
  }
}
