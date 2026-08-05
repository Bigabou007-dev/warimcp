/**
 * scripts/smoke-hub2-sandbox.ts
 *
 * Sandbox smoke test for the Hub2 payment adapter.
 * Creates a payment intent with the magic sandbox msisdn (00000001),
 * then polls verifyPayment up to 60 s, printing each raw response.
 *
 * Prerequisites (in .env):
 *   HUB2_API_KEY      — sandbox API key
 *   HUB2_MERCHANT_ID  — sandbox merchant ID
 *   WARIMCP_MODE      — must be "sandbox" (not "live")
 *
 * Run: npx tsx scripts/smoke-hub2-sandbox.ts
 */

import "dotenv/config";
import { hub2Provider } from "../src/providers/hub2.js";
import { HttpError } from "../src/utils/http-error.js";

const apiKey = process.env.HUB2_API_KEY ?? "";
const merchantId = process.env.HUB2_MERCHANT_ID ?? "";
const mode = process.env.WARIMCP_MODE ?? "mock";

// Guard: refuse to run without credentials or in live mode
const missing: string[] = [];
if (!apiKey) missing.push("HUB2_API_KEY");
if (!merchantId) missing.push("HUB2_MERCHANT_ID");

if (missing.length > 0) {
  console.error(
    `[smoke-hub2] REFUSED — the following required env vars are not set: ${missing.join(", ")}.\n` +
    `Set them in .env before running the smoke script.`
  );
  process.exit(1);
}

if (mode === "live") {
  console.error(
    `[smoke-hub2] REFUSED — WARIMCP_MODE is "live". ` +
    `This script only runs in sandbox mode. Set WARIMCP_MODE=sandbox in .env.`
  );
  process.exit(1);
}

// Magic sandbox msisdn per Hub2 docs; amount 100 XOF; provider mtn
const MAGIC_MSISDN = "00000001";
const AMOUNT = 100;
const CURRENCY = "XOF";
const PROVIDER = "mtn";

async function main() {
  console.log("[smoke-hub2] Starting sandbox smoke — initiating payment...");

  let intentRef: string;
  try {
    const initResult = await hub2Provider.initiatePayment({
      amount: AMOUNT,
      currency: CURRENCY,
      customerPhone: MAGIC_MSISDN,
      description: "Hub2 sandbox smoke test",
      reference: `smoke-${Date.now()}`,
      callbackUrl: "https://example.com/webhook",
      metadata: { provider: PROVIDER },
    });
    console.log("[smoke-hub2] initiatePayment response:", JSON.stringify(initResult, null, 2));
    intentRef = initResult.providerReference;
  } catch (err) {
    console.error("[smoke-hub2] initiatePayment FAILED:", err);
    process.exit(1);
  }

  console.log(`[smoke-hub2] Polling verifyPayment for intent ${intentRef} (up to 60s)...`);

  const POLL_INTERVAL_MS = 5_000;
  const MAX_POLLS = Math.ceil(60_000 / POLL_INTERVAL_MS);
  const NON_TRANSIENT_STATUSES = [401, 403, 404];
  let polls = 0;
  let anyPollSucceeded = false;
  let terminalReached = false;

  while (polls < MAX_POLLS) {
    polls++;
    try {
      const verifyResult = await hub2Provider.verifyPayment(intentRef);
      anyPollSucceeded = true;
      console.log(
        `[smoke-hub2] poll ${polls}/${MAX_POLLS} — verifyPayment response:`,
        JSON.stringify(verifyResult, null, 2)
      );
      if (verifyResult.status === "completed" || verifyResult.status === "failed") {
        console.log(`[smoke-hub2] Terminal status "${verifyResult.status}" reached — done.`);
        terminalReached = true;
        break;
      }
    } catch (err) {
      // Non-transient HTTP errors (auth failure, wrong endpoint) will not
      // recover by polling — abort immediately with a failure exit code.
      if (err instanceof HttpError && NON_TRANSIENT_STATUSES.includes(err.status)) {
        console.error(
          `[smoke-hub2] smoke FAILED — verifyPayment returned HTTP ${err.status} (non-transient): ${err.message}\n` +
          `Check HUB2_API_KEY / HUB2_MERCHANT_ID and the verify endpoint path.`
        );
        process.exit(1);
      }
      console.error(`[smoke-hub2] poll ${polls}/${MAX_POLLS} — verifyPayment FAILED:`, err);
      // Continue polling on transient errors
    }

    if (polls < MAX_POLLS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  if (!anyPollSucceeded) {
    console.error(
      `[smoke-hub2] smoke FAILED — all ${MAX_POLLS} verifyPayment polls errored; no successful response from Hub2.`
    );
    process.exit(1);
  }

  if (!terminalReached) {
    console.log("[smoke-hub2] 60s elapsed without terminal status — smoke complete (no error).");
  }

  console.log("[smoke-hub2] Smoke script finished.");
}

main().catch((err) => {
  console.error("[smoke-hub2] Unhandled error:", err);
  process.exit(1);
});
