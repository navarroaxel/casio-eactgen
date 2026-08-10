import { describe, expect, it } from "vitest";
import { encode, encodeLine, EACT_OVERRIDE } from "./encode";

describe("encode", () => {
  it("passes printable ASCII through unchanged", () => {
    expect(encode("Hello, World! 123")).toEqual(
      [..."Hello, World! 123"].map((c) => c.charCodeAt(0)),
    );
  });

  it("emits a superscript group for ^{...} and single-char ^x", () => {
    expect(encode("x^{2}")).toEqual([
      "x".charCodeAt(0),
      0xa8, // POWER
      0x1a, // SUP_OPEN
      "2".charCodeAt(0),
      0x1b, // SUP_CLOSE
    ]);
    expect(encode("x^2")).toEqual(encode("x^{2}"));
  });

  it("emits a subscript run for _{...} and single-char _x", () => {
    expect(encode("x_{12}")).toEqual([
      "x".charCodeAt(0),
      0xe5,
      0xd1, // digit 1
      0xe5,
      0xd2, // digit 2
    ]);
    expect(encode("x_1")).toEqual([
      "x".charCodeAt(0),
      0xe5,
      0xd1,
    ]);
  });

  it("expands \\frac{a}{b} into the stacked-fraction opcode sequence", () => {
    expect(encode("\\frac{1}{2}")).toEqual([
      0xbb, 0x1d, // FRAC_PREFIX
      0x1a, "1".charCodeAt(0), 0x1b, // numerator group
      0x1a, "2".charCodeAt(0), 0x1b, // denominator group
      0x1e, // FRAC_SUFFIX
    ]);
  });

  it("encodes the vulgar fraction ½ identically to \\frac{1}{2}", () => {
    expect(encode("½")).toEqual(encode("\\frac{1}{2}"));
  });

  it("resolves LaTeX-style symbol names before structural parsing", () => {
    expect(encode("\\pi")).toEqual(encode("π"));
    expect(encode("\\le")).toEqual(encode("≤"));
  });

  it("applies EactMaker's glyph overrides instead of the table default", () => {
    expect(encode("∇")).toEqual([0xe6, 0xda]);
    expect(encode("▽")).toEqual([0xe6, 0xda]);
    expect(encode("+")).toEqual([EACT_OVERRIDE["+"]]);
  });

  it("throws for a codepoint absent from the CASIO table", () => {
    expect(() => encode("∞")).toThrow(/no CASIO mapping/);
  });

  it("throws on an unbalanced brace group", () => {
    expect(() => encode("\\frac{1}{2")).toThrow(/unbalanced/);
  });
});

describe("encodeLine", () => {
  it("encodes a plain line with isNote = false", () => {
    const [bytes, isNote] = encodeLine("abc");
    expect(isNote).toBe(false);
    expect(bytes).toEqual(encode("abc"));
  });

  it("routes \\note{title}{body} through the note builder with isNote = true", () => {
    const [, isNote] = encodeLine("\\note{Title}{Body text}");
    expect(isNote).toBe(true);
  });
});
