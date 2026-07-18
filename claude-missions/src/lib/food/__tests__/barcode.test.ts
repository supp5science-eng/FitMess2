import { describe, expect, it } from "vitest";

import { gtinSchema, MALFORMED_GTIN_ERROR_SR } from "@/lib/food/barcode";

// F031: pure validation coverage for `gtinSchema` -- the same "13 or 8
// digits, matching BarcodeScanner's narrowed formats" contract
// `GET /api/foods/barcode/[gtin]` relies on before ever touching the DB.

describe("F031: gtinSchema", () => {
  it("accepts a valid 13-digit EAN-13 GTIN", () => {
    const result = gtinSchema.safeParse("5901234123457");
    expect(result.success).toBe(true);
  });

  it("accepts a valid 8-digit EAN-8 GTIN", () => {
    const result = gtinSchema.safeParse("96385074");
    expect(result.success).toBe(true);
  });

  it("rejects a GTIN with the wrong digit count", () => {
    const result = gtinSchema.safeParse("12345");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(MALFORMED_GTIN_ERROR_SR);
    }
  });

  it("rejects a GTIN containing non-digit characters", () => {
    const result = gtinSchema.safeParse("590123412345x");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = gtinSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects a script-injection-shaped value, never crashing", () => {
    const result = gtinSchema.safeParse("<script>alert(1)</script>");
    expect(result.success).toBe(false);
  });
});
