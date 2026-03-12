import { describe, it, expect } from "vitest";
import { validateAmount, formatXOF } from "../../../src/utils/money.js";

describe("validateAmount", () => {
  it("accepts valid amounts", () => {
    expect(validateAmount(100)).toBeNull();
    expect(validateAmount(5000)).toBeNull();
    expect(validateAmount(5_000_000)).toBeNull();
  });

  it("rejects decimals", () => {
    expect(validateAmount(100.5)).toContain("whole number");
  });

  it("rejects below minimum", () => {
    expect(validateAmount(50)).toContain("at least");
  });

  it("rejects above maximum", () => {
    expect(validateAmount(6_000_000)).toContain("at most");
  });
});

describe("formatXOF", () => {
  it("formats amounts with FCFA suffix", () => {
    const result = formatXOF(5000);
    expect(result).toContain("5");
    expect(result).toContain("FCFA");
  });
});
