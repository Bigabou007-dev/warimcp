import { describe, it, expect } from "vitest";

// Base env required by config — set BEFORE importing anything that reads it.
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const { getProvider, getProviderNames } = await import("../../src/providers/registry.js");

// CinetPay was hard-removed 2026-08-05 due to an unresolved $1.2M+ merchant
// settlement risk following the Sept-2025 cyberattack. Hub2 and FedaPay are
// the rails going forward. This test ensures the provider never silently
// re-enters the registry.
describe("cinetpay provider is permanently absent", () => {
  it("registry does NOT contain cinetpay", () => {
    const names = getProviderNames();
    expect(names).not.toContain("cinetpay");
  });

  it("requesting the cinetpay provider throws Unknown provider", () => {
    expect(() => getProvider("cinetpay")).toThrow(/Unknown provider/);
  });

  it("fedapay is still present (primary rail)", () => {
    const names = getProviderNames();
    expect(names).toContain("fedapay");
  });

  it("hub2 is still present (secondary rail)", () => {
    const names = getProviderNames();
    expect(names).toContain("hub2");
  });
});
