import { describe, it, expect } from "vitest";
import { normalizeHub2Status, normalizeMsisdnForHub2 } from "../../../src/providers/hub2.js";

describe("normalizeHub2Status", () => {
  it("maps Hub2 wire statuses to WariMCP vocabulary", () => {
    expect(normalizeHub2Status("payment_required")).toBe("pending");
    expect(normalizeHub2Status("processing")).toBe("processing");
    expect(normalizeHub2Status("succeeded")).toBe("completed");
    expect(normalizeHub2Status("successful")).toBe("completed");
    expect(normalizeHub2Status("failed")).toBe("failed");
    expect(normalizeHub2Status("expired")).toBe("failed");
  });
  it("throws on unknown wire status (never silently passes through)", () => {
    expect(() => normalizeHub2Status("mystery")).toThrow(/Unknown Hub2 status/);
  });
  it("throws on empty string", () => {
    expect(() => normalizeHub2Status("")).toThrow(/Unknown Hub2 status/);
  });
});

describe("normalizeMsisdnForHub2", () => {
  it("strips +225 E.164 to bare local", () => {
    expect(normalizeMsisdnForHub2("+2250777210927")).toBe("0777210927");
  });
  it("passes CIV local through", () => {
    expect(normalizeMsisdnForHub2("0777210927")).toBe("0777210927");
  });
  it("passes 8-digit sandbox magic through untouched", () => {
    expect(normalizeMsisdnForHub2("00000001")).toBe("00000001");
  });
  it("strips bare 225 country-code prefix to local", () => {
    expect(normalizeMsisdnForHub2("2250777210927")).toBe("0777210927");
  });
  it("strips whitespace before matching E.164", () => {
    expect(normalizeMsisdnForHub2("+225 0777 210927")).toBe("0777210927");
  });
  it("lenient fallback: non-CIV E.164 only loses its leading + (never throws)", () => {
    expect(normalizeMsisdnForHub2("+22177001234")).toBe("22177001234");
  });
  it("lenient fallback: empty string passes through as empty string", () => {
    expect(normalizeMsisdnForHub2("")).toBe("");
  });
});
