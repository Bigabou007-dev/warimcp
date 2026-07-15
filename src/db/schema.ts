import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  integer,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    type: text("type").notNull().default("payment"), // payment | payout | refund
    status: text("status").notNull().default("pending"), // pending | processing | completed | failed | refunded
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("XOF"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerEmail: text("customer_email"),
    description: text("description"),
    paymentUrl: text("payment_url"),
    callbackUrl: text("callback_url"),
    metadata: jsonb("metadata").default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("idx_tx_idempotency").on(t.idempotencyKey),
    index("idx_tx_provider_ref").on(t.provider, t.providerReference),
    index("idx_tx_status").on(t.status),
    index("idx_tx_callback").on(t.callbackUrl),
  ]
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    provider: text("provider").notNull(),
    eventType: text("event_type").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    processed: boolean("processed").default(false),
    relayStatus: text("relay_status").default("pending"), // pending | relayed | failed
    relayAttempts: integer("relay_attempts").default(0),
    relayLastError: text("relay_last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_wh_tx").on(t.transactionId),
    index("idx_wh_relay_pending").on(t.relayStatus),
  ]
);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label").notNull(),
  permissions: text("permissions").array().default(["payment:initiate", "payment:verify"]),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    status: text("status").notNull().default("pending"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("XOF"),
    recipientPhone: text("recipient_phone").notNull(),
    recipientName: text("recipient_name"),
    method: text("method").notNull(), // mobile_money | bank
    metadata: jsonb("metadata").default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("idx_po_idempotency").on(t.idempotencyKey),
    index("idx_po_status").on(t.status),
  ]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    action: text("action").notNull(),
    actor: text("actor"),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_audit_tx").on(t.transactionId)]
);

// --- Prepaid mobile-money credits (billing door 3) ---
// One credit account per API key; balance denominated in XOF (no subunits).
// The ledger is append-only: topups carry the funding transaction id (unique,
// so a replayed webhook can never double-credit); per-call charges carry NULL.
export const creditAccounts = pgTable(
  "credit_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    balanceXof: bigint("balance_xof", { mode: "number" }).notNull().default(0),
    totalToppedUpXof: bigint("total_topped_up_xof", { mode: "number" })
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("idx_credit_api_key").on(t.apiKeyId)]
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: serial("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => creditAccounts.id),
    deltaXof: bigint("delta_xof", { mode: "number" }).notNull(), // + topup, - charge
    reason: text("reason").notNull(), // topup | charge:<METHOD path>
    transactionId: uuid("transaction_id").references(() => transactions.id).unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_ledger_account").on(t.accountId)]
);
