/**
 * Payment Instruction Page — mobile-friendly HTML page showing how to pay.
 *
 * GET /pay/:referenceCode        → HTML payment instructions
 * GET /pay/:referenceCode/status → JSON payment status (for auto-refresh)
 */

import { Router, type Request, type Response } from "express";
import { getReference } from "./reference-generator.js";
import { getConfig } from "../config.js";

export const paymentPageRouter = Router();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

function buildPaymentHtml(
  referenceCode: string,
  amount: number,
  waveNumber: string,
  omNumber: string,
  paid: boolean
): string {
  const amountStr = formatAmount(amount);
  const escapedRef = escapeHtml(referenceCode);

  const paidBanner = paid
    ? `<div class="banner success">
        <div class="banner-icon">&#10003;</div>
        <div class="banner-text">Paiement confirme !</div>
        <div class="banner-sub">Payment confirmed!</div>
      </div>`
    : "";

  const pendingSection = paid
    ? ""
    : `
      <div class="section">
        <h2>Envoyez exactement :</h2>
        <div class="amount">${amountStr} FCFA</div>
        <p class="amount-note">Le montant exact est important pour identifier votre paiement.<br>
        <em>The exact amount is important to identify your payment.</em></p>
      </div>

      ${
        waveNumber
          ? `<div class="section method">
              <h3>Wave</h3>
              <div class="number">${escapeHtml(waveNumber)}</div>
              <p>Envoyez <strong>${amountStr} FCFA</strong> a ce numero via Wave.<br>
              <em>Send <strong>${amountStr} FCFA</strong> to this number via Wave.</em></p>
            </div>`
          : ""
      }

      ${
        omNumber
          ? `<div class="section method">
              <h3>Orange Money</h3>
              <div class="number">${escapeHtml(omNumber)}</div>
              <p>Envoyez <strong>${amountStr} FCFA</strong> a ce numero via Orange Money.<br>
              <em>Send <strong>${amountStr} FCFA</strong> to this number via Orange Money.</em></p>
            </div>`
          : ""
      }

      <div class="section">
        <div class="ref-label">Votre reference / Your reference:</div>
        <div class="ref-code">${escapedRef}</div>
        <p class="ref-note">Conservez ce code. Il sera verifie automatiquement.<br>
        <em>Keep this code. It will be verified automatically.</em></p>
      </div>

      <div class="waiting">
        <div class="spinner"></div>
        <p>En attente de confirmation...<br><em>Waiting for confirmation...</em></p>
      </div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement — Lagoon Tech</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f6f9;
      color: #0F2A47;
      min-height: 100vh;
    }
    .header {
      background: #0F2A47;
      color: #fff;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      font-size: 1.3rem;
      font-weight: 600;
    }
    .header .brand {
      color: #D4A012;
      font-size: 0.85rem;
      margin-top: 4px;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      padding: 20px 16px;
    }
    .banner {
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 20px;
    }
    .banner.success {
      background: #d4edda;
      border: 2px solid #28a745;
      color: #155724;
    }
    .banner-icon {
      font-size: 3rem;
      margin-bottom: 8px;
    }
    .banner-text {
      font-size: 1.3rem;
      font-weight: 700;
    }
    .banner-sub {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-top: 4px;
    }
    .section {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .section h2 {
      font-size: 1rem;
      color: #666;
      margin-bottom: 8px;
    }
    .section h3 {
      font-size: 1rem;
      color: #0F2A47;
      margin-bottom: 8px;
    }
    .amount {
      font-size: 2.2rem;
      font-weight: 800;
      color: #D4A012;
      text-align: center;
      padding: 12px 0;
    }
    .amount-note {
      font-size: 0.85rem;
      color: #666;
      text-align: center;
    }
    .method {
      border-left: 4px solid #D4A012;
    }
    .number {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0F2A47;
      letter-spacing: 1px;
      padding: 8px 0;
    }
    .method p {
      font-size: 0.9rem;
      color: #555;
      line-height: 1.5;
    }
    .ref-label {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 4px;
    }
    .ref-code {
      font-family: "Courier New", monospace;
      font-size: 1.1rem;
      font-weight: 700;
      background: #f0f0f0;
      padding: 10px;
      border-radius: 6px;
      text-align: center;
      letter-spacing: 1px;
    }
    .ref-note {
      font-size: 0.8rem;
      color: #888;
      margin-top: 8px;
    }
    .waiting {
      text-align: center;
      padding: 24px;
      color: #666;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #ddd;
      border-top: 3px solid #D4A012;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .waiting p {
      font-size: 0.9rem;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 0.75rem;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Paiement / Payment</h1>
    <div class="brand">Lagoon Tech Systems</div>
  </div>
  <div class="container">
    ${paidBanner}
    ${pendingSection}
  </div>
  <div class="footer">Lagoon Tech Systems &mdash; lagoontechsystems.com</div>
  ${
    paid
      ? ""
      : `<script>
    (function() {
      var ref = "${escapedRef}";
      function check() {
        fetch("/pay/" + encodeURIComponent(ref) + "/status")
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.paid) { window.location.reload(); }
          })
          .catch(function() {});
      }
      setInterval(check, 10000);
    })();
  </script>`
  }
</body>
</html>`;
}

/** GET /pay/:referenceCode — HTML payment instructions */
paymentPageRouter.get("/:referenceCode", (req: Request, res: Response) => {
  const referenceCode = String(req.params.referenceCode);
  const ref = getReference(referenceCode);

  if (!ref) {
    res.status(404).send(
      buildErrorHtml(
        "Reference introuvable",
        "Ce lien de paiement est invalide ou a expire.",
        "This payment link is invalid or has expired."
      )
    );
    return;
  }

  const config = getConfig();
  const html = buildPaymentHtml(
    ref.referenceCode,
    ref.uniqueAmount,
    config.MANUAL_PAYMENT_WAVE_NUMBER,
    config.MANUAL_PAYMENT_OM_NUMBER,
    ref.paid
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

/** GET /pay/:referenceCode/status — JSON status check */
paymentPageRouter.get(
  "/:referenceCode/status",
  (req: Request, res: Response) => {
    const referenceCode = String(req.params.referenceCode);
    const ref = getReference(referenceCode);

    if (!ref) {
      res.status(404).json({
        error: "Reference not found",
        referenceCode,
      });
      return;
    }

    res.json({
      paid: ref.paid,
      referenceCode: ref.referenceCode,
      amount: ref.uniqueAmount,
      baseAmount: ref.baseAmount,
      ...(ref.paidAt ? { paidAt: ref.paidAt.toISOString() } : {}),
    });
  }
);

function buildErrorHtml(title: string, messageFr: string, messageEn: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Lagoon Tech</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f6f9;
      color: #0F2A47;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 32px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .card h1 { font-size: 1.2rem; margin-bottom: 12px; }
    .card p { font-size: 0.95rem; color: #555; line-height: 1.6; }
    .card em { font-size: 0.85rem; color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(messageFr)}</p>
    <p><em>${escapeHtml(messageEn)}</em></p>
  </div>
</body>
</html>`;
}
