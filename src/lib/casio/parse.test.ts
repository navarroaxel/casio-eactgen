import { describe, expect, it } from "vitest";
import { buildEact } from "./index";
import { parseEact } from "./parse";

describe("parseEact", () => {
  it("round-trips a \\note{}{} line through the nested sub-container", () => {
    const src = "before\n\\note{My Note}{Some note body text}\nafter";
    const bytes = buildEact("T", src);
    expect(parseEact(bytes).content).toBe(src);
  });

  it("strips the padding EactMaker adds to a short title", () => {
    const bytes = buildEact("Hi", "x");
    expect(parseEact(bytes).title).toBe("Hi");
  });

  it("reports lossy = true when a cell holds an unmapped byte", () => {
    // Corrupt the single line cell's payload byte with a value that has no
    // markup form, while keeping the container otherwise well-formed.
    const bytes = buildEact("T", "A");
    const idx = bytes.lastIndexOf(0x41); // the 'A' line cell's byte, at the tail
    bytes[idx] = 0xff;
    expect(parseEact(bytes).lossy).toBe(true);
  });
});
