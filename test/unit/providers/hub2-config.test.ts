import { describe, it, expect } from "vitest";

// Set env before importing config
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { getConfig } from "../../../src/config.js";

describe("hub2 config", () => {
  it("defaults HUB2_BASE_URL and empty merchant/webhook fields", () => {
    const c = getConfig();
    expect(c.HUB2_BASE_URL).toBe("https://api.hub2.io");
    expect(typeof c.HUB2_MERCHANT_ID).toBe("string");
    expect(typeof c.HUB2_WEBHOOK_SECRET).toBe("string");
  });
});
