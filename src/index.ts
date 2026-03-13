import * as dotenv from "dotenv";
import * as path from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { loadConfig } from "./config.js";
import { createHttpServer } from "./server/http.js";
import { startMcpServer } from "./server/mcp.js";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const config = loadConfig();

const sql = postgres(config.DATABASE_URL);
const db = drizzle(sql);

async function main() {
  const transport = config.WARIMCP_TRANSPORT;

  if (transport === "http" || transport === "both") {
    createHttpServer(db, config.WARIMCP_PORT);
  }

  if (transport === "stdio" || transport === "both") {
    await startMcpServer(db);
  }

  if (transport === "http") {
    console.error(`WariMCP running in HTTP-only mode on port ${config.WARIMCP_PORT}`);
  } else if (transport === "stdio") {
    console.error("WariMCP running in MCP stdio-only mode");
  } else {
    console.error(`WariMCP running in dual mode — HTTP:${config.WARIMCP_PORT} + MCP stdio`);
  }
}

main().catch((err) => {
  console.error("Failed to start WariMCP:", err);
  process.exit(1);
});
