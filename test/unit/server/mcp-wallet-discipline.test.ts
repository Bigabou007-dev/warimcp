import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { buildMcpServer } from "../../../src/server/mcp.js";

async function connectedClient() {
  // db is never touched: the wallet-discipline parse rejects before any provider work
  const db = {} as unknown as PostgresJsDatabase;
  const server = buildMcpServer(db);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "wallet-discipline-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

function firstText(result: { content?: unknown }): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0]?.text ?? "";
}

describe("MCP-layer wallet discipline enforcement (I5)", () => {
  it("initiate_payment via MCP transport rejects usdc without agentWalletSignature", async () => {
    const { client, server } = await connectedClient();
    const result = await client.callTool({
      name: "initiate_payment",
      arguments: {
        provider: "mock", amount: 1000, currency: "XOF", idempotencyKey: "idem-key-001",
        description: "d", customerName: "n", customerPhone: "00000001",
        fundsSource: "usdc", walletProvider: "phantom",
      },
    });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/agentWalletSignature is required when fundsSource is usdc/);
    await client.close();
    await server.close();
  });

  it("generate_payment_link via MCP transport rejects usdc without walletProvider", async () => {
    const { client, server } = await connectedClient();
    const result = await client.callTool({
      name: "generate_payment_link",
      arguments: {
        provider: "mock", amount: 1000, currency: "XOF", description: "d",
        fundsSource: "usdc", agentWalletSignature: "sig",
      },
    });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/walletProvider is required when fundsSource is usdc/);
    await client.close();
    await server.close();
  });

  it("initiate_payout via MCP transport rejects usdc without both wallet fields", async () => {
    const { client, server } = await connectedClient();
    const result = await client.callTool({
      name: "initiate_payout",
      arguments: {
        provider: "mock", amount: 1000, currency: "XOF", idempotencyKey: "idem-key-002",
        recipientPhone: "00000001", recipientName: "n", method: "mobile_money",
        fundsSource: "usdc",
      },
    });
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/agentWalletSignature is required when fundsSource is usdc/);
    expect(firstText(result)).toMatch(/walletProvider is required when fundsSource is usdc/);
    await client.close();
    await server.close();
  });
});
