import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { initiatePayment } from "../tools/initiate-payment.js";
import { verifyPayment } from "../tools/verify-payment.js";
import { refundPayment } from "../tools/refund-payment.js";
import { listTransactions } from "../tools/list-transactions.js";
import { generatePaymentLink } from "../tools/generate-payment-link.js";
import { listProviders } from "../tools/list-providers.js";
import { initiatePayout } from "../tools/initiate-payout.js";
import { verifyPayout } from "../tools/verify-payout.js";

export async function startMcpServer(db: PostgresJsDatabase) {
  const server = new McpServer({
    name: "warimcp",
    version: "2.0.0",
  });

  server.tool(
    "list_providers",
    "List all WariMCP payment providers, their configuration status, and supported rails",
    {},
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(listProviders(), null, 2) }],
    })
  );

  server.tool(
    "initiate_payment",
    "Initiate a payment through any configured WariMCP provider. Returns a checkout URL for the customer.",
    {
      provider: z.string().default("cinetpay").describe("Payment provider: cinetpay, wave, mock"),
      amount: z.number().int().min(100).max(5_000_000).describe("Amount in whole currency units (e.g. 5000 for 5000 XOF)"),
      currency: z.string().default("XOF").describe("ISO currency code: XOF, XAF, CDF, GNF"),
      idempotencyKey: z.string().min(6).max(128).describe("Unique key to prevent duplicate payments"),
      description: z.string().default("Payment").describe("Payment description shown to customer"),
      customerName: z.string().min(1).describe("Full customer name"),
      customerEmail: z.string().optional().default("").describe("Customer email"),
      customerPhone: z.string().min(8).describe("Phone in international format: +2250707070707"),
      returnUrl: z.string().optional().default("").describe("Redirect URL after payment"),
      callbackUrl: z.string().optional().default("").describe("Your webhook URL for payment notifications"),
    },
    async ({ provider, amount, currency, idempotencyKey, description, customerName, customerEmail, customerPhone, returnUrl, callbackUrl }) => {
      try {
        const result = await initiatePayment(db, {
          provider, amount, currency, idempotencyKey, description,
          customerName, customerEmail: customerEmail || "", customerPhone,
          returnUrl: returnUrl || "", notifyUrl: "", callbackUrl: callbackUrl || "",
          metadata: {},
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  server.tool(
    "verify_payment",
    "Check the status of a payment transaction",
    {
      transactionId: z.string().uuid().describe("The WariMCP transaction ID"),
    },
    async ({ transactionId }) => {
      try {
        const result = await verifyPayment(db, transactionId);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  server.tool(
    "refund_payment",
    "Issue a refund for a completed payment transaction",
    {
      transactionId: z.string().uuid().describe("The WariMCP transaction ID to refund"),
      amount: z.number().int().min(1).optional().describe("Partial refund amount (omit for full refund)"),
      reason: z.string().optional().default("").describe("Reason for refund"),
    },
    async ({ transactionId, amount, reason }) => {
      try {
        const result = await refundPayment(db, transactionId, amount, reason);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_transactions",
    "List recent payment transactions with optional filters",
    {
      provider: z.string().optional().describe("Filter by provider: cinetpay, wave, mock"),
      status: z.string().optional().describe("Filter by status: pending, completed, failed, refunded"),
      limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async ({ provider, status, limit, offset }) => {
      try {
        const result = await listTransactions(db, { provider, status, limit, offset });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  server.tool(
    "generate_payment_link",
    "Generate a shareable payment link for a customer",
    {
      provider: z.string().default("cinetpay").describe("Payment provider"),
      amount: z.number().int().min(100).max(5_000_000).describe("Amount in whole currency units"),
      currency: z.string().default("XOF").describe("ISO currency code"),
      description: z.string().default("Payment").describe("Payment description"),
    },
    async ({ provider, amount, currency, description }) => {
      try {
        const result = await generatePaymentLink(db, { provider, amount, currency, description, metadata: {} });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  server.tool(
    "initiate_payout",
    "Disburse funds to a mobile money wallet or bank account (seller payouts)",
    {
      provider: z.string().default("wave").describe("Payout provider: wave"),
      amount: z.number().int().min(100).max(5_000_000).describe("Payout amount"),
      currency: z.string().default("XOF").describe("Currency"),
      idempotencyKey: z.string().min(6).max(128).describe("Unique key to prevent duplicate payouts"),
      recipientPhone: z.string().min(8).describe("Recipient phone: +2250707070707"),
      recipientName: z.string().min(1).describe("Recipient name"),
      method: z.enum(["mobile_money", "bank"]).default("mobile_money").describe("Payout method"),
    },
    async ({ provider, amount, currency, idempotencyKey, recipientPhone, recipientName, method }) => {
      try {
        const result = await initiatePayout(db, {
          provider, amount, currency, idempotencyKey,
          recipientPhone, recipientName, method, metadata: {},
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  server.tool(
    "verify_payout",
    "Check the status of a payout",
    {
      payoutId: z.string().uuid().describe("The WariMCP payout ID"),
    },
    async ({ payoutId }) => {
      try {
        const result = await verifyPayout(db, payoutId);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WariMCP MCP server started (stdio transport)");

  return server;
}
