import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";

const opts = { format: "g2e", compatibility: false } as const;

describe("analyze", () => {
  it("reports size and one preview row per line", () => {
    const a = analyze("T", "a+b\nc", opts);
    expect(a.error).toBeNull();
    expect(a.lineCount).toBe(2);
    expect(a.preview).toHaveLength(2);
    expect(a.size).toBeGreaterThan(0);
  });

  it("flags \\note lines in the preview", () => {
    const a = analyze("T", "\\note{Hi}{body}", opts);
    expect(a.preview[0]).toEqual({ text: "\\note{Hi}{body}", note: true });
  });

  it("surfaces encoder errors and a null size", () => {
    const a = analyze("T", "∞", opts); // ∞ is absent from the CASIO table
    expect(a.size).toBeNull();
    expect(a.error).toBeTruthy();
  });
});
