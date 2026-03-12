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

  WARIMCP_WEBHOOK_BASE_URL: z.string().default(""),
  WARIMCP_RELAY_SECRET: z.string().default(""),
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
