/**
 * demo-agent-payment.ts
 *
 * Track 2 acceptance artifact: narrated merchant demo for the WariMCP
 * authorize_and_pay bridge.
 *
 * Scenario: WhatsApp-style conversation (simulated transport — Meta verification
 * pending). A customer orders 2 items; the merchant agent computes the total,
 * constructs + signs a payment mandate, calls authorize_and_pay, then prints
 * the confirmation and reconciliation row.
 *
 * Provider: mock (sandbox credentials pending — swap point: see SWAP POINT
 * comment below; change provider arg from "mock" to "hub2" or "fedapay" once
 * sandbox creds land in .env).
 *
 * No live keys are read. No .env is loaded. No real network calls.
 */

// ---------------------------------------------------------------------------
// Env preamble — MUST be set before importing config (config caches on first
// getConfig() call). Mirror the test-file pattern exactly.
// ---------------------------------------------------------------------------
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://demo:demo@localhost:5432/demo";
// WARIMCP_TRUSTED_AGENT_KEYS is set below after keypair generation (requires
// dynamic value), followed by resetConfig().

import { generateKeyPairSync, sign } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { resetConfig } from "../src/config.js";
import {
  canonicalMandateBytes,
  type PaymentMandate,
} from "../src/bridge/authorization.js";
import { handleAuthorizeAndPay } from "../src/tools/authorize-and-pay.js";

// ---------------------------------------------------------------------------
// In-memory DB stub (same shape as test/unit/tools/authorize-and-pay.test.ts).
// Holds the inserted row so we can print the reconciliation line at the end.
// ---------------------------------------------------------------------------
interface StoredRow {
  id: string;
  provider: string;
  status: string;
  paymentUrl: string | null;
  providerReference?: string;
  merchantRef?: string;
  amount?: number;
}

function makeStubDb() {
  const rows: StoredRow[] = [];
  let pendingValues: Partial<StoredRow> | null = null;

  const stub = {
    select: () => stub,
    from: () => stub,
    where: () => stub,
    limit: () => Promise.resolve([]), // idempotency check: no existing tx
    insert: () => stub,
    values: (vals: Record<string, unknown>) => {
      // Capture the insert values so returning() can build the row.
      pendingValues = {
        id: "00000000-0000-0000-0000-000000000042",
        provider: (vals.provider as string) ?? "mock",
        status: "pending",
        paymentUrl: null,
        amount: vals.amount as number | undefined,
        merchantRef: vals.description as string | undefined,
      };
      return stub;
    },
    returning: () => {
      const row = pendingValues ?? {
        id: "00000000-0000-0000-0000-000000000042",
        provider: "mock",
        status: "pending",
        paymentUrl: null,
      };
      rows.push(row as StoredRow);
      pendingValues = null;
      return Promise.resolve([row]);
    },
    update: () => stub,
    set: (vals: Record<string, unknown>) => {
      // Merge update fields into the last stored row so reconciliation is accurate.
      if (rows.length > 0) {
        Object.assign(rows[rows.length - 1], vals);
      }
      return stub;
    },
    // Returns a snapshot of stored rows for reconciliation.
    getRows: () => rows,
  };
  return { db: stub as unknown as PostgresJsDatabase, getRows: stub.getRows };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function print(line: string) {
  process.stdout.write(line + "\n");
}

function separator(label?: string) {
  const bar = "─".repeat(60);
  print(label ? `\n${bar}\n  ${label}\n${bar}` : bar);
}

function chat(speaker: "CLIENT" | "AGENT", msg: string) {
  const prefix = speaker === "CLIENT" ? "👤 Client" : "🤖 Agent ";
  print(`${prefix}  │ ${msg}`);
}

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------
async function run() {
  separator("WariMCP — Demo Paiement Agent  [2026-08-05]");
  print("Simulation transport WhatsApp (Meta vérification en attente).");
  print("provider: mock  (sandbox credentials pending — swap point: 'provider' const in this script)");
  print("");

  // --- Scene 1: customer conversation ---
  separator("Scène 1 : Commande client");
  chat("CLIENT", "Bonjour ! Je voudrais commander 2 articles stp.");
  chat("CLIENT", "  • T-shirt coton bio × 1  →  12 500 XOF");
  chat("CLIENT", "  • Casquette brodée   × 1  →   7 500 XOF");
  chat("CLIENT", "Mon numéro de paiement : +225 07 00 00 00 42");
  chat("AGENT", "Bonjour ! Voici le récapitulatif de votre commande :");
  chat("AGENT", "  T-shirt coton bio    12 500 XOF");
  chat("AGENT", "  Casquette brodée      7 500 XOF");
  chat("AGENT", "  ─────────────────────────────");
  chat("AGENT", "  Total               20 000 XOF");
  chat("AGENT", "Je génère votre lien de paiement sécurisé...");
  print("");

  // --- Step 2: keypair generation (happens entirely server-side) ---
  separator("Étape 2 : Génération du mandat signé (côté agent)");

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  print("Clé Ed25519 générée en mémoire (éphémère — jetée après la session).");
  print(`Fingerprint PEM public : ${publicPem.split("\n")[1].slice(0, 24)}…`);

  // Inject the public key into server config BEFORE first getConfig() call.
  process.env.WARIMCP_TRUSTED_AGENT_KEYS = publicPem;
  resetConfig(); // flush the cached config so the new key is picked up

  const merchantRef = `ORDER-20260805-0042`;
  const nonce = `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const amount = 20_000; // 12500 + 7500 XOF — within [100..5_000_000] bounds

  const mandate: PaymentMandate = {
    amount,
    currency: "XOF",
    merchantRef,
    expiresAtMs: Date.now() + 5 * 60_000, // 5 minutes
    nonce,
  };

  const signature = sign(null, canonicalMandateBytes(mandate), privateKey).toString("base64");

  print(`Mandat construit :`);
  print(`  merchantRef  : ${mandate.merchantRef}`);
  print(`  amount       : ${mandate.amount} XOF`);
  print(`  currency     : ${mandate.currency}`);
  print(`  nonce        : ${mandate.nonce.slice(0, 32)}…`);
  print(`  expiresAtMs  : ${new Date(mandate.expiresAtMs).toISOString()}`);
  print(`  signature    : ${signature.slice(0, 32)}… (base64 Ed25519)`);
  print("");

  // --- Step 3: call authorize_and_pay ---
  separator("Étape 3 : Appel authorize_and_pay");
  print("Vérification du mandat contre WARIMCP_TRUSTED_AGENT_KEYS…");

  const { db, getRows } = makeStubDb();

  // SWAP POINT — three changes required to exercise a real provider (not one):
  //   1. Change "mock" below to "hub2" (or "fedapay").
  //   2. Remove / override `process.env.WARIMCP_MODE = "mock"` at the top of this
  //      file and set WARIMCP_MODE=sandbox in the environment — without this,
  //      registry.ts routes to the mock adapter regardless of the provider string.
  //   3. Load real sandbox credentials into the environment before running
  //      (HUB2_API_KEY + HUB2_MERCHANT_ID for Hub2, or FedaPay equivalent).
  //      This script deliberately loads no .env; all three steps are needed.
  const provider = "mock";

  const result = await handleAuthorizeAndPay(db, {
    mandate,
    signature,
    provider, // <-- SWAP POINT: see comment above — "hub2" | "fedapay" + WARIMCP_MODE=sandbox + creds
    customerPhone: "+22507000000042",
    customerEmail: undefined,
    returnUrl: "https://boutique.example.ci/merci",
    notifyUrl: "https://boutique.example.ci/webhook/warimcp",
  });

  if (!result.authorized) {
    print(`[ERREUR] Autorisation refusée : ${result.reason}`);
    process.exit(1);
  }

  print(`✓ authorized : true`);
  print(`  transactionId     : ${result.payment.transactionId}`);
  print(`  providerReference : ${result.payment.providerReference}`);
  print(`  status            : ${result.payment.status}`);
  print(`  paymentUrl        : ${result.payment.paymentUrl ?? "(mock — pas de redirect)"}`);
  print(`  provider          : ${result.payment.provider}  (mock — sandbox creds pending)`);
  print("");

  // --- Step 4: simulated verify / poll ---
  separator("Étape 4 : Vérification du paiement (simulée)");
  print("En production : poll verify_payment jusqu'à status=completed.");
  print(`[mock] Transaction ${result.payment.transactionId} → status: ${result.payment.status}`);
  print("");

  // --- Step 5: confirmation message ---
  separator("Étape 5 : Confirmation au client");
  chat("AGENT", `✅ Votre paiement de ${amount.toLocaleString("fr-CI")} XOF a été initié.`);
  chat("AGENT", `   Référence commande : ${merchantRef}`);
  chat("AGENT", `   Référence paiement : ${result.payment.providerReference}`);
  chat("AGENT", "   Vous recevrez une confirmation SMS dans quelques instants.");
  chat("CLIENT", "Merci beaucoup ! 🙏");
  print("");

  // --- Step 6: reconciliation row ---
  separator("Étape 6 : Ligne de réconciliation (list_transactions)");
  const storedRows = getRows();
  const row = storedRows[storedRows.length - 1];

  print("Équivalent list_transactions { provider: 'mock' } :");
  print("");
  print(
    [
      "merchantRef".padEnd(28),
      "amount".padEnd(12),
      "status".padEnd(12),
      "providerReference",
    ].join("")
  );
  print("─".repeat(72));
  print(
    [
      (merchantRef).padEnd(28),
      `${amount} XOF`.padEnd(12),
      (row?.status ?? "pending").padEnd(12),
      result.payment.providerReference ?? "(mock)",
    ].join("")
  );
  print("");

  separator("Fin de la démonstration");
  print("Ce qui est simulé  : transport (WhatsApp), DB (stub in-memory), provider (mock).");
  print("Ce qui est réel    : crypto Ed25519, vérification de mandat, flux authorize_and_pay.");
  print("Changements pour sandbox (3 étapes — pas une seule) :");
  print("  1. Changer provider 'mock' → 'hub2' (ou 'fedapay') dans ce fichier.");
  print("  2. Retirer/remplacer process.env.WARIMCP_MODE='mock' → WARIMCP_MODE=sandbox");
  print("     (sans ça, registry.ts route vers mock indépendamment du provider choisi).");
  print("  3. Charger les vrais creds sandbox dans l'env (HUB2_API_KEY, HUB2_MERCHANT_ID).");
  print("     Ce script ne charge aucun .env — les 3 étapes sont nécessaires.");
  print("");
  print("Changements supplémentaires pour production :");
  print("  4. Remplacer le stub DB par la vraie connection Postgres (DATABASE_URL).");
  print("  5. Activer le transport MCP réel (stdio/http) à la place du import direct.");
  print("  6. BCEAO 001-01-2024 : flag.authorized doit rester OFF en production réelle");
  print("     jusqu'à la levée des obligations réglementaires. Voir ROADMAP.md §Phase 2.");
  print("");
}

run().catch((err) => {
  console.error("[demo] Fatal error:", err);
  process.exit(1);
});
