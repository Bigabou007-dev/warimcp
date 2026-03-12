/**
 * XOF/XAF have no fractional units — all amounts are whole integers.
 * This module enforces integer-only arithmetic for payment amounts.
 */

export function validateAmount(amount: number, min = 100, max = 5_000_000): string | null {
  if (!Number.isInteger(amount)) return "Amount must be a whole number (no decimals)";
  if (amount < min) return `Amount must be at least ${min}`;
  if (amount > max) return `Amount must be at most ${max}`;
  return null;
}

export function formatXOF(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}
