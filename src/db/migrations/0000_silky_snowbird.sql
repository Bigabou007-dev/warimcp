CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"label" text NOT NULL,
	"permissions" text[] DEFAULT '{"payment:initiate","payment:verify"}',
	"rate_limit_per_minute" integer DEFAULT 60,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" uuid,
	"action" text NOT NULL,
	"actor" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_name" text,
	"method" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "payouts_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"type" text DEFAULT 'payment' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_email" text,
	"description" text,
	"payment_url" text,
	"callback_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"signature_valid" boolean NOT NULL,
	"processed" boolean DEFAULT false,
	"relay_status" text DEFAULT 'pending',
	"relay_attempts" integer DEFAULT 0,
	"relay_last_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_tx" ON "audit_log" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_po_idempotency" ON "payouts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_po_status" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tx_idempotency" ON "transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_tx_provider_ref" ON "transactions" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "idx_tx_status" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tx_callback" ON "transactions" USING btree ("callback_url");--> statement-breakpoint
CREATE INDEX "idx_wh_tx" ON "webhook_events" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_wh_relay_pending" ON "webhook_events" USING btree ("relay_status");