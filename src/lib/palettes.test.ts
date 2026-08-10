import { describe, expect, it } from "vitest";
import { encode } from "./casio/encode";
import { PALETTES } from "./palettes";

describe("PALETTES", () => {
  it("has unique, non-empty palette ids", () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("every item's insert text is encodable (module-load invariant)", () => {
    for (const palette of PALETTES) {
      for (const item of palette.items) {
        expect(() => encode(item.insert)).not.toThrow();
      }
    }
  });

  it("every palette has at least one item", () => {
    for (const palette of PALETTES) {
      expect(palette.items.length).toBeGreaterThan(0);
    }
  });
});
