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
import { handleAuthorizeAndPay } from "../tools/authorize-and-pay.js";
import {
  InitiatePaymentSchema,
  GeneratePaymentLinkSchema,
  InitiatePayoutSchema,
  AuthorizeAndPaySchema,
} from "../tools/definitions.js";

export function buildMcpServer(db: PostgresJsDatabase) {
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
      provider: z.string().default("fedapay").describe("Payment provider: fedapay, wave, hub2, mock"),
      amount: z.number().int().min(100).max(5_000_000).describe("Amount in whole currency units (e.g. 5000 for 5000 XOF)"),
      currency: z.string().default("XOF").describe("ISO currency code: XOF, XAF, CDF, GNF"),
      idempotencyKey: z.string().min(6).max(128).describe("Unique key to prevent duplicate payments"),
      description: z.string().default("Payment").describe("Payment description shown to customer"),
      customerName: z.string().min(1).describe("Full customer name"),
      customerEmail: z.string().optional().default("").describe("Customer email"),
      customerPhone: z.string().min(8).describe("Phone in international format: +2250707070707"),
      returnUrl: z.string().optional().default("").describe("Redirect URL after payment"),
      callbackUrl: z.string().optional().default("").describe("Your webhook URL for payment notifications"),
      fundsSource: z.enum(["fiat", "usdc"]).default("fiat").describe("Source of funds: fiat (mobile money) or usdc (crypto-settled)"),
      agentWalletSignature: z.string().optional().describe("Required when fundsSource is usdc: agent-signed attestation of the transfer"),
      walletProvider: z.string().optional().describe("Required when fundsSource is usdc: name of the non-custodial wallet provider (e.g. phantom)"),
    },
    async (args) => {
      try {
        // I5 wallet discipline: the SDK only accepts a raw field shape here, so the
        // superRefine cannot run at the transport layer — enforce it in the handler.
        const input = InitiatePaymentSchema.parse(args);
        const result = await initiatePayment(db, input);
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
      provider: z.string().optional().describe("Filter by provider: fedapay, wave, hub2, mock"),
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
      provider: z.string().default("fedapay").describe("Payment provider"),
      amount: z.number().int().min(100).max(5_000_000).describe("Amount in whole currency units"),
      currency: z.string().default("XOF").describe("ISO currency code"),
      description: z.string().default("Payment").describe("Payment description"),
      fundsSource: z.enum(["fiat", "usdc"]).default("fiat").describe("Source of funds: fiat (mobile money) or usdc (crypto-settled)"),
      agentWalletSignature: z.string().optional().describe("Required when fundsSource is usdc: agent-signed attestation of the transfer"),
      walletProvider: z.string().optional().describe("Required when fundsSource is usdc: name of the non-custodial wallet provider (e.g. phantom)"),
    },
    async (args) => {
      try {
        // I5 wallet discipline enforced in-handler (see initiate_payment note)
        const input = GeneratePaymentLinkSchema.parse(args);
        const result = await generatePaymentLink(db, input);
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
      fundsSource: z.enum(["fiat", "usdc"]).default("fiat").describe("Source of funds: fiat (mobile money) or usdc (crypto-settled)"),
      agentWalletSignature: z.string().optional().describe("Required when fundsSource is usdc: agent-signed attestation of the transfer"),
      walletProvider: z.string().optional().describe("Required when fundsSource is usdc: name of the non-custodial wallet provider (e.g. phantom)"),
    },
    async (args) => {
      try {
        // I5 wallet discipline enforced in-handler (see initiate_payment note)
        const input = InitiatePayoutSchema.parse(args);
        const result = await initiatePayout(db, input);
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

  server.tool(
    "authorize_and_pay",
    "Verify an agent-signed payment mandate against the server-side trusted-key allowlist (WARIMCP_TRUSTED_AGENT_KEYS), then immediately initiate payment through the specified provider. Returns { authorized: true, payment } on success, or { authorized: false, reason } if the mandate is invalid — without touching any provider.",
    {
      mandate: z.object({
        amount: z.number().int().min(100).max(5_000_000).describe("Amount in whole currency units (bounds mirror initiate_payment)"),
        currency: z.string().describe("ISO currency code (e.g. XOF)"),
        merchantRef: z.string().min(1).describe("Merchant-side reference for this mandate"),
        expiresAtMs: z.number().int().describe("Unix timestamp in ms after which the mandate is invalid"),
        nonce: z.string().min(1).describe("Unique nonce — used as idempotency key; never reuse"),
      }).describe("The payment mandate the agent signed"),
      signature: z.string().min(1).describe("Base64-encoded Ed25519 signature of the canonical mandate bytes"),
      provider: z.string().min(1).describe("Payment provider: mock, wave, hub2, fedapay"),
      customerPhone: z.string().min(8).describe("Customer phone in international format"),
      customerEmail: z.string().optional().describe("Customer email (optional)"),
      returnUrl: z.string().describe("Redirect URL after payment"),
      notifyUrl: z.string().describe("Webhook URL for payment notifications"),
    },
    async (args) => {
      try {
        // Parse + validate with full schema before any business logic.
        const input = AuthorizeAndPaySchema.parse(args);
        const result = await handleAuthorizeAndPay(db, input);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` }], isError: true };
      }
    }
  );

  return server;
}

export async function startMcpServer(db: PostgresJsDatabase) {
  const server = buildMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WariMCP MCP server started (stdio transport)");

  return server;
}
