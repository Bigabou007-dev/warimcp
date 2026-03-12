import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import crypto from "node:crypto";
import * as dotenv from "dotenv";
import * as path from "path";
import { apiKeys } from "./schema.js";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const label = process.argv[2] || "default";

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

async function main() {
  const rawKey = `wari_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  await db.insert(apiKeys).values({
    keyHash,
    label,
    permissions: ["payment:initiate", "payment:verify", "payment:refund", "payout:initiate", "payout:verify"],
    rateLimitPerMinute: 60,
    active: true,
  });

  console.log(`API key created for "${label}":`);
  console.log(`  Key: ${rawKey}`);
  console.log(`  (Save this — it cannot be retrieved again)`);

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
