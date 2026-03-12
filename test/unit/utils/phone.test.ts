import { describe, it, expect } from "vitest";
import { validatePhone, normalizePhone } from "../../../src/utils/phone.js";

describe("validatePhone", () => {
  it("accepts valid Ivorian numbers", () => {
    expect(validatePhone("+2250707070707")).toBeNull();
    expect(validatePhone("2250707070707")).toBeNull();
  });

  it("accepts valid Senegalese numbers", () => {
    expect(validatePhone("+221771234567")).toBeNull();
  });

  it("rejects invalid numbers", () => {
    expect(validatePhone("12345")).not.toBeNull();
    expect(validatePhone("+1234567890")).not.toBeNull();
  });
});

describe("normalizePhone", () => {
  it("adds + prefix if missing", () => {
    expect(normalizePhone("2250707070707")).toBe("+2250707070707");
  });

  it("keeps + prefix if present", () => {
    expect(normalizePhone("+2250707070707")).toBe("+2250707070707");
  });

  it("strips spaces and dashes", () => {
    expect(normalizePhone("+225 07 07 070 707")).toBe("+2250707070707");
  });
});
