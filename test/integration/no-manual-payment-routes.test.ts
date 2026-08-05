import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Base env required by config — set BEFORE importing anything that reads it.
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000"; // config requires >=1; actual listen port is 0 (ephemeral) below
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { createHttpServer } = await import("../../src/server/http.js");

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

// The manual-payment-collection feature (personal Wave/OM account + SMS
// reconciliation) was hard-removed 2026-06-12 as unlicensed custody, incompatible
// with the BYOK no-custody posture. These routes must never exist again.
describe("manual-payment-collection routes are permanently absent", () => {
  it("GET /pay/:ref does not exist (404)", async () => {
    const res = await fetch(`${baseUrl}/pay/anyref`);
    expect(res.status).toBe(404);
  });

  it("POST /api/sms-webhook does not exist (404)", async () => {
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
