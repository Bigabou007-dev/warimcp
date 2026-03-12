import { describe, it, expect } from "vitest";

process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { getProvider, getAllProviders, getProviderNames } from "../../../src/providers/registry.js";

describe("Provider Registry", () => {
  it("returns mock provider in mock mode", () => {
    const provider = getProvider("cinetpay");
    expect(provider.name).toBe("mock");
  });

  it("returns mock provider directly", () => {
    const provider = getProvider("mock");
    expect(provider.name).toBe("mock");
  });

  it("throws for unknown provider", () => {
    // In mock mode, unknown providers still hit the mock check first
    // but "unknown" is not a registered provider
    expect(() => getProvider("nonexistent")).toThrow("Unknown provider");
  });

  it("lists all providers", () => {
    const providers = getAllProviders();
    expect(providers.length).toBeGreaterThanOrEqual(5);
  });

  it("lists provider names", () => {
    const names = getProviderNames();
    expect(names).toContain("mock");
    expect(names).toContain("cinetpay");
    expect(names).toContain("wave");
  });
});
