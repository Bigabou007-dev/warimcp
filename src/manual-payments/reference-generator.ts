/**
 * Manual Payment Reference Generator
 *
 * Generates unique payment amounts by adding a 1–99 XOF suffix to the base price.
 * This lets us match incoming Wave/Orange Money transfers to specific orders
 * without API access (pre-RCCM workaround).
 *
 * Example: base 5000 XOF -> generates 5001, 5002, ... 5099, then wraps.
 */

export interface PaymentReference {
  baseAmount: number;
  uniqueAmount: number;
  suffix: number;
  referenceCode: string; // e.g., "PAY-5001-0325-A3"
  expiresAt: Date; // 30 min TTL
  paid: boolean;
  createdAt: Date;
  senderInfo?: string;
  paidAt?: Date;
}

/** Rolling counters per base amount (1–99) */
const counters = new Map<number, number>();

/** Active references keyed by referenceCode */
const activeReferences = new Map<string, PaymentReference>();

/** Index from uniqueAmount to referenceCode for fast lookups */
const amountIndex = new Map<number, string>();

const TTL_MS = 30 * 60 * 1000; // 30 minutes

function getNextSuffix(baseAmount: number): number {
  const current = counters.get(baseAmount) ?? 0;
  const next = current >= 99 ? 1 : current + 1;
  counters.set(baseAmount, next);
  return next;
}

function generateCode(uniqueAmount: number): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  // Random 2-char alphanumeric tag to reduce collisions on wrap-around
  const tag = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `PAY-${uniqueAmount}-${month}${day}-${tag}`;
}

/**
 * Generate a unique payment reference for a given base amount.
 * Adds a 1–99 XOF suffix and returns a trackable reference.
 */
export function generatePaymentReference(baseAmount: number): PaymentReference {
  if (baseAmount <= 0 || !Number.isInteger(baseAmount)) {
    throw new Error("baseAmount must be a positive integer");
  }

  // Try up to 99 suffixes to find one not currently in use
  let suffix = 0;
  let uniqueAmount = 0;
  let attempts = 0;

  while (attempts < 99) {
    suffix = getNextSuffix(baseAmount);
    uniqueAmount = baseAmount + suffix;

    const existingCode = amountIndex.get(uniqueAmount);
    if (!existingCode) break;

    // Check if existing reference has expired or been paid
    const existing = activeReferences.get(existingCode);
    if (!existing || existing.paid || existing.expiresAt.getTime() < Date.now()) {
      // Clean up stale entry
      if (existing) {
        activeReferences.delete(existingCode);
        amountIndex.delete(uniqueAmount);
      }
      break;
    }
    attempts++;
  }

  if (attempts >= 99) {
    throw new Error(
      `All 99 suffixes for base amount ${baseAmount} are in use. Wait for expiration or process pending payments.`
    );
  }

  const referenceCode = generateCode(uniqueAmount);
  const now = new Date();

  const ref: PaymentReference = {
    baseAmount,
    uniqueAmount,
    suffix,
    referenceCode,
    expiresAt: new Date(now.getTime() + TTL_MS),
    paid: false,
    createdAt: now,
  };

  activeReferences.set(referenceCode, ref);
  amountIndex.set(uniqueAmount, referenceCode);

  return ref;
}

/**
 * Try to match a received payment amount to an active reference.
 * Returns the matching reference or null if no match found.
 */
export function matchPayment(receivedAmount: number): PaymentReference | null {
  const referenceCode = amountIndex.get(receivedAmount);
  if (!referenceCode) return null;

  const ref = activeReferences.get(referenceCode);
  if (!ref) return null;

  // Skip already-paid or expired references
  if (ref.paid) return null;
  if (ref.expiresAt.getTime() < Date.now()) {
    activeReferences.delete(referenceCode);
    amountIndex.delete(receivedAmount);
    return null;
  }

  return ref;
}

/**
 * Mark a reference as paid.
 */
export function markReferenceAsPaid(referenceCode: string, senderInfo?: string): boolean {
  const ref = activeReferences.get(referenceCode);
  if (!ref) return false;

  ref.paid = true;
  ref.paidAt = new Date();
  if (senderInfo) ref.senderInfo = senderInfo;

  // Remove from amount index so the suffix can be reused
  amountIndex.delete(ref.uniqueAmount);

  return true;
}

/**
 * Look up a reference by its code.
 */
export function getReference(referenceCode: string): PaymentReference | null {
  return activeReferences.get(referenceCode) ?? null;
}

/**
 * Clean up expired and paid references older than 1 hour.
 * Returns the number of references removed.
 */
export function expireStaleReferences(): number {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  let removed = 0;

  for (const [code, ref] of activeReferences) {
    const isExpired = ref.expiresAt.getTime() < now;
    const isPaidAndOld = ref.paid && ref.createdAt.getTime() < oneHourAgo;

    if (isExpired || isPaidAndOld) {
      activeReferences.delete(code);
      amountIndex.delete(ref.uniqueAmount);
      removed++;
    }
  }

  return removed;
}

/**
 * Get all active (non-expired, non-paid) references. Useful for debugging.
 */
export function getActiveReferences(): PaymentReference[] {
  const now = Date.now();
  const result: PaymentReference[] = [];

  for (const ref of activeReferences.values()) {
    if (!ref.paid && ref.expiresAt.getTime() >= now) {
      result.push(ref);
    }
  }

  return result;
}
