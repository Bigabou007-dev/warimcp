import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Base env required by config — set BEFORE importing anything that reads it.
// Here we explicitly enable the feature so the routes ARE mounted.
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000"; // config requires >=1; the actual listen port is 0 (ephemeral) below
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.MANUAL_PAYMENT_COLLECTION_ENABLED = "true";

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

describe("manual-payment-collection — ENABLED via flag (routes mounted)", () => {
  it("GET /pay/:ref hits the router — renders its HTML 'not found' page for an unknown ref", async () => {
    const res = await fetch(`${baseUrl}/pay/unknownref`);
    expect(res.status).toBe(404);
    // Proves the router ran (vs. a bare Express 404): it serves its own HTML page.
    const body = await res.text();
    expect(body).toContain("Reference introuvable");
  });

  it("POST /api/sms-webhook hits the router — returns 422 on an invalid payload", async () => {
    const res = await fetch(`${baseUrl}/api/sms-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // missing required sender/message → router validation 422
    });
    expect(res.status).toBe(422);
  });
});
