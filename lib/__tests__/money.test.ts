import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { toCents, fromCents, formatMoney } from "../money";

describe("toCents", () => {
  it("converts a decimal string to integer cents", () => {
    expect(toCents("12.50")).toBe(1250);
  });

  it("converts a number to integer cents", () => {
    expect(toCents(12.5)).toBe(1250);
  });

  it("rounds to the nearest cent instead of truncating", () => {
    expect(toCents(1.009)).toBe(101);
  });

  it("handles whole numbers", () => {
    expect(toCents(10)).toBe(1000);
  });

  it("handles zero", () => {
    expect(toCents(0)).toBe(0);
  });

  it("throws on negative amounts", () => {
    expect(() => toCents(-5)).toThrow("Invalid amount");
  });

  it("throws on non-numeric strings", () => {
    expect(() => toCents("abc")).toThrow("Invalid amount");
  });

  it("throws on NaN / Infinity", () => {
    expect(() => toCents(NaN)).toThrow("Invalid amount");
    expect(() => toCents(Infinity)).toThrow("Invalid amount");
  });

  it("throws on absurdly large amounts (fat-finger guard)", () => {
    expect(() => toCents(10_000_001)).toThrow("Invalid amount");
  });

  it("accepts the exact ceiling amount", () => {
    expect(toCents(10_000_000)).toBe(1_000_000_000);
  });
});

describe("fromCents", () => {
  it("converts cents back to a decimal amount", () => {
    expect(fromCents(1250)).toBe(12.5);
  });

  it("round-trips with toCents for clean values", () => {
    expect(fromCents(toCents("99.99"))).toBeCloseTo(99.99);
  });

  it("handles zero", () => {
    expect(fromCents(0)).toBe(0);
  });
});

describe("formatMoney", () => {
  const originalCurrency = process.env.NEXT_PUBLIC_CURRENCY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CURRENCY;
  });

  afterEach(() => {
    if (originalCurrency === undefined) delete process.env.NEXT_PUBLIC_CURRENCY;
    else process.env.NEXT_PUBLIC_CURRENCY = originalCurrency;
  });

  it("formats cents with two decimal places", () => {
    expect(formatMoney(1250)).toBe("KSh 12.50");
  });

  it("pads whole amounts to two decimals", () => {
    expect(formatMoney(500)).toBe("KSh 5.00");
  });

  it("falls back to 0 for non-finite input instead of throwing", () => {
    expect(formatMoney(NaN)).toBe("KSh 0.00");
  });
});
