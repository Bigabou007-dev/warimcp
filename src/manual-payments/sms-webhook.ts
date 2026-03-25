/**
 * SMS Webhook — receives forwarded SMS from Android phone (Tasker/MacroDroid).
 *
 * Parses Wave and Orange Money transaction confirmations, extracts amounts,
 * and matches them to pending payment references.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { matchPayment, markReferenceAsPaid } from "./reference-generator.js";
import { getConfig } from "../config.js";

export const smsWebhookRouter = Router();

const SmsPayloadSchema = z.object({
  sender: z.string().min(1, "sender is required"),
  message: z.string().min(1, "message is required"),
  timestamp: z.string().optional(),
});

type SmsPayload = z.infer<typeof SmsPayloadSchema>;

interface ParsedTransaction {
  amount: number;
  sender: string;
  provider: "wave" | "orange_money" | "unknown";
  raw: string;
}

/**
 * Parse a Wave SMS.
 * Format: "Vous avez recu 5 001 FCFA de JOHN DOE"
 * Also: "Vous avez recu 5001 FCFA de JOHN DOE"
 */
function parseWaveSms(message: string): ParsedTransaction | null {
  // Wave amounts may have spaces as thousand separators
  const match = message.match(
    /[Vv]ous avez re[cç]u\s+([\d\s]+)\s*(?:FCFA|F CFA|XOF)\s+de\s+(.+)/i
  );
  if (!match) return null;

  const rawAmount = match[1].replace(/\s+/g, "");
  const amount = parseInt(rawAmount, 10);
  if (isNaN(amount) || amount <= 0) return null;

  const sender = match[2].trim();

  return { amount, sender, provider: "wave", raw: message };
}

/**
 * Parse an Orange Money SMS.
 * Format: "Vous avez recu un depot de 5001 FCFA de 0554072860"
 * Also: "Vous avez recu un depot de 5 001 FCFA de 0554072860"
 */
function parseOrangeMoneyTrxSms(message: string): ParsedTransaction | null {
  const match = message.match(
    /[Vv]ous avez re[cç]u un (?:d[eé]p[oô]t|transfert|paiement)\s+de\s+([\d\s]+)\s*(?:FCFA|F CFA|XOF)\s+de\s+(.+)/i
  );
  if (!match) return null;

  const rawAmount = match[1].replace(/\s+/g, "");
  const amount = parseInt(rawAmount, 10);
  if (isNaN(amount) || amount <= 0) return null;

  const sender = match[2].trim();

  return { amount, sender, provider: "orange_money", raw: message };
}

/**
 * Try all known SMS parsers.
 */
function parseTransactionSms(message: string): ParsedTransaction | null {
  return parseWaveSms(message) ?? parseOrangeMoneyTrxSms(message) ?? null;
}

/**
 * Notify business owner via the WhatsApp agent.
 */
async function notifyViaWhatsApp(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const resp = await fetch("http://localhost:3100/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, message }),
    });
    return resp.ok;
  } catch {
    console.error("[sms-webhook] Failed to send WhatsApp notification");
    return false;
  }
}

smsWebhookRouter.post("/", async (req: Request, res: Response) => {
  // Validate input
  const parsed = SmsPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: "Validation failed",
      details: parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  const payload: SmsPayload = parsed.data;
  const transaction = parseTransactionSms(payload.message);

  if (!transaction) {
    // Not a recognized payment SMS — acknowledge but do nothing
    res.json({
      matched: false,
      reason: "SMS does not match any known payment format",
    });
    return;
  }

  console.error(
    `[sms-webhook] Parsed ${transaction.provider} payment: ${transaction.amount} XOF from ${transaction.sender}`
  );

  // Try to match to a pending payment reference
  const ref = matchPayment(transaction.amount);

  if (!ref) {
    console.error(
      `[sms-webhook] No matching reference for amount ${transaction.amount}`
    );
    res.json({
      matched: false,
      amount: transaction.amount,
      provider: transaction.provider,
      reason: "No pending reference matches this amount",
    });
    return;
  }

  // Mark as paid
  markReferenceAsPaid(ref.referenceCode, transaction.sender);

  console.error(
    `[sms-webhook] Payment matched! Ref ${ref.referenceCode} — ${transaction.amount} XOF from ${transaction.sender}`
  );

  // Notify business owner via WhatsApp
  const config = getConfig();
  const notifyPhone = config.MANUAL_PAYMENT_WHATSAPP_NOTIFY;

  if (notifyPhone) {
    const providerLabel =
      transaction.provider === "wave" ? "Wave" : "Orange Money";
    const msg = [
      `Paiement recu !`,
      ``,
      `Montant: ${transaction.amount.toLocaleString("fr-FR")} FCFA`,
      `De: ${transaction.sender}`,
      `Via: ${providerLabel}`,
      `Reference: ${ref.referenceCode}`,
      ``,
      `Le client a ete notifie automatiquement.`,
    ].join("\n");

    await notifyViaWhatsApp(notifyPhone, msg);
  }

  res.json({
    matched: true,
    referenceCode: ref.referenceCode,
    amount: transaction.amount,
    baseAmount: ref.baseAmount,
    sender: transaction.sender,
    provider: transaction.provider,
    paidAt: ref.paidAt?.toISOString(),
  });
});
