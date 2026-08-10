import { describe, expect, it } from "vitest";
import { decode, decodeMarkup } from "./decode";
import { encode } from "./encode";

describe("decode", () => {
  it("passes printable ASCII through unchanged", () => {
    expect(decode([..."Hi 42!"].map((c) => c.charCodeAt(0)))).toBe("Hi 42!");
  });

  it("renders the superscript opcodes as ^( ... ) in display mode", () => {
    expect(decode(encode("x^{2}"))).toBe("x^(2)");
  });

  it("drops null bytes in display mode but shows them as ␀ in raw mode", () => {
    expect(decode([0x41, 0x00, 0x42])).toBe("AB");
    expect(decode([0x41, 0x00, 0x42], true)).toBe("A␀B");
  });

  it("falls back to a \\xHH escape for unmapped codes", () => {
    expect(decode([0xff])).toBe("\\xff");
  });
});

describe("decodeMarkup", () => {
  it("is the inverse of encode() for a mix of structures", () => {
    const src = "x^{2}+\\frac{1}{2}+\\sqrt{y}_{n}";
    const { text, lossy } = decodeMarkup(encode(src));
    expect(text).toBe(src);
    expect(lossy).toBe(false);
  });

  it("is lossless as bytes (though lossy as text) for ASCII hyphen-minus", () => {
    // The CASIO table's canonical Unicode form for this byte is U+2010
    // (HYPHEN), not ASCII "-" (U+002D) — both encode to the same byte, and
    // decodeMarkup() normalises to the table's form, per AGENTS.md.
    const bytes = encode("a-b");
    expect(encode(decodeMarkup(bytes).text)).toEqual(bytes);
  });

  it("normalises the ▽ override glyph back to its canonical ∇ form", () => {
    expect(decodeMarkup(encode("▽")).text).toBe("∇");
  });

  it("marks bytes with no markup form as lossy \\xHH escapes", () => {
    const { text, lossy } = decodeMarkup([0xff]);
    expect(lossy).toBe(true);
    expect(text).toBe("\\xff");
  });

  it("re-encodes back to the original bytes (round-trip contract)", () => {
    const src = "\\log{2}{8}+\\sum{n}{k}{0}{k}";
    const bytes = encode(src);
    const { text } = decodeMarkup(bytes);
    expect(encode(text)).toEqual(bytes);
  });
});
