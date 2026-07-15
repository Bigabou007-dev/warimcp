import { z } from "zod";

const envSchema = z.object({
  WARIMCP_MODE: z.enum(["mock", "sandbox", "live"]).default("mock"),
  WARIMCP_TRANSPORT: z.enum(["stdio", "http", "both"]).default("both"),
  WARIMCP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().min(1),

  CINETPAY_API_KEY: z.string().default(""),
  CINETPAY_SITE_ID: z.string().default(""),

  WAVE_API_KEY: z.string().default(""),
  WAVE_WEBHOOK_SECRET: z.string().default(""),

  HUB2_API_KEY: z.string().default(""),
  PAPSS_API_KEY: z.string().default(""),

  FLUTTERWAVE_SECRET_KEY: z.string().default(""),
  FLUTTERWAVE_PUBLIC_KEY: z.string().default(""),

  KKIAPAY_PUBLIC_KEY: z.string().default(""),
  KKIAPAY_PRIVATE_KEY: z.string().default(""),
  KKIAPAY_SECRET: z.string().default(""),

  MONEROO_SECRET_KEY: z.string().default(""),

  FEDAPAY_SECRET_KEY: z.string().default(""),
  FEDAPAY_PUBLIC_KEY: z.string().default(""),

  MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY: z.string().default(""),
  MTN_MOMO_API_USER: z.string().default(""),
  MTN_MOMO_API_KEY: z.string().default(""),
  MTN_MOMO_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  MTN_MOMO_CALLBACK_URL: z.string().default(""),

  WARIMCP_WEBHOOK_BASE_URL: z.string().default(""),
  WARIMCP_RELAY_SECRET: z.string().default(""),
  // Manual-payment-collection config removed 2026-06-12 (custody feature deleted).

  // --- x402 pay-per-call billing (dual door alongside X-Api-Key auth) ---
  // When enabled, requests WITHOUT an X-Api-Key header may pay per call in
  // USDC via the x402 protocol instead of holding an account.
  X402_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  // Wallet that receives USDC. REQUIRED when X402_ENABLED=true.
  X402_PAY_TO: z.string().default(""),
  // CAIP-2 network id. Base mainnet: eip155:8453 · Base Sepolia: eip155:84532
  X402_NETWORK: z.string().default("eip155:8453"),
  X402_FACILITATOR_URL: z.string().default("https://facilitator.x402.org"),
  // Money-format prices (converted to USDC by the x402 middleware).
  X402_PRICE_WRITE: z.string().default("$0.02"), // initiate/refund/payout/link
  X402_PRICE_READ: z.string().default("$0.005"), // verify/list
  // Sync supported payment kinds from the facilitator (lazy, on first priced
  // request). REQUIRED for challenges to be issued — only disable in tests.
  X402_SYNC_ON_START: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;
  _config = envSchema.parse(process.env);
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}
