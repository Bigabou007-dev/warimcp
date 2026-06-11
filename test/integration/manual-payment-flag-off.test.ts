import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Base env required by config — set BEFORE importing anything that reads it.
// Crucially we do NOT set MANUAL_PAYMENT_COLLECTION_ENABLED → it must default OFF.
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000"; // config requires >=1; the actual listen port is 0 (ephemeral) below
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { createHttpServer } = await import("../../src/server/http.js");

// Manual-payment routes never touch the DB; a bare stub is sufficient.
const stubDb = {} as never;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createHttpServer(stubDb, 0) as unknown as Server;
    server.on("listening", () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("manual-payment-collection — DISABLED by default (fail-closed)", () => {
  it("GET /pay/:ref returns a bare 404 — the router is not mounted", async () => {
    const res = await fetch(`${baseUrl}/pay/anyref`);
    expect(res.status).toBe(404);
    // If the manual-payment router were mounted it would render an HTML page
    // containing this string. Its absence proves the route does not exist.
    const body = await res.text();
    expect(body).not.toContain("Reference introuvable");
  });

  it("POST /api/sms-webhook returns 404 — the router is not mounted", async () => {
    const res = await fetch(`${baseUrl}/api/sms-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: "Wave", message: "Vous avez recu 5001 FCFA de X" }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /health still returns 200 — the rest of the server is healthy", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
