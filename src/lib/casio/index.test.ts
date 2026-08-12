import { describe, expect, it } from "vitest";
import { buildEact, parseEact, splitlines } from "./index";

describe("splitlines", () => {
  it("matches Python str.splitlines() for the trailing-newline case", () => {
    expect(splitlines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitlines("a\nb")).toEqual(["a", "b"]);
    expect(splitlines("")).toEqual([]);
    expect(splitlines("\n")).toEqual([""]);
  });

  it("handles \\r\\n and bare \\r", () => {
    expect(splitlines("a\r\nb\rc")).toEqual(["a", "b", "c"]);
  });
});

describe("buildEact / parseEact", () => {
  it("round-trips a simple multi-line body through the byte container", () => {
    const bytes = buildEact("MyTitle", "hello\nworld", { format: "g2e" });
    const parsed = parseEact(bytes);
    expect(parsed.title).toBe("MyTitle");
    expect(parsed.content).toBe("hello\nworld");
    expect(parsed.format).toBe("g2e");
    expect(parsed.lossy).toBe(false);
  });

  it("truncates the title to 8 characters, as the calculator does", () => {
    const bytes = buildEact("WayTooLongATitle", "x");
    expect(parseEact(bytes).title).toBe("WayTooLo");
  });

  it("detects g3e from the container's subtype block", () => {
    const bytes = buildEact("T", "x", { format: "g3e" });
    expect(parseEact(bytes).format).toBe("g3e");
  });

  it("g1e and g2e produce byte-identical containers (by design)", () => {
    const g1 = buildEact("T", "x^{2}", { format: "g1e" });
    const g2 = buildEact("T", "x^{2}", { format: "g2e" });
    expect(Array.from(g1)).toEqual(Array.from(g2));
  });

  it("round-trips markup: superscripts, fractions, and subscripts", () => {
    const src = "x^{2}+\\frac{1}{2}+y_{n+1}";
    const bytes = buildEact("T", src);
    expect(parseEact(bytes).content).toBe(src);
  });

  it("rejects a too-short buffer", () => {
    expect(() => parseEact(new Uint8Array(4))).toThrow();
  });

  it("rejects bytes that aren't a recognised eActivity container", () => {
    expect(() => parseEact(new Uint8Array(0x94))).toThrow();
  });
});
