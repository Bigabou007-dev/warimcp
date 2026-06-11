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

  // Manual payment collection (pre-RCCM)
  MANUAL_PAYMENT_WAVE_NUMBER: z.string().default(""),
  MANUAL_PAYMENT_OM_NUMBER: z.string().default(""),
  MANUAL_PAYMENT_WHATSAPP_NOTIFY: z.string().default(""),
  MANUAL_PAYMENT_SMS_SECRET: z.string().default(""),

  // Manual-payment-collection master switch — DISABLED BY DEFAULT.
  // Routes customer funds into a personal Wave/OM account = unlicensed payment
  // collection under BCEAO Instruction n°001-01-2024 (see ROADMAP.md "CRITICAL").
  // Only the literal "true" enables it; absence or any other value = OFF.
  // Deliberately NOT z.coerce.boolean() — that coerces the string "false" to true.
  MANUAL_PAYMENT_COLLECTION_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
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
