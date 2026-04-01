import { describe, expect, it } from "vitest";
import { goldVndPerLuongFromPayload, silverVndPerGramFromPayload } from "./marketN8nPayload";

describe("marketN8nPayload", () => {
  it("parses gold ban string with thousand dots", () => {
    expect(goldVndPerLuongFromPayload({ ban: "17.380.000", donVi: "lượng" })).toBe(17380000);
  });

  it("parses gold ban per luong", () => {
    expect(goldVndPerLuongFromPayload({ ban: 17380000, donVi: "lượng" })).toBe(17380000);
    expect(goldVndPerLuongFromPayload({ sellPrice: 17380000 })).toBe(17380000);
  });

  it("parses gold per chi when unit hints chi", () => {
    expect(goldVndPerLuongFromPayload({ ban: 1738000, donVi: "chỉ" })).toBe(17380000);
  });

  it("parses silver per kg to per gram", () => {
    expect(silverVndPerGramFromPayload({ ban: 25000000, donVi: "kg" })).toBe(25000);
  });
});
