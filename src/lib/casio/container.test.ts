import { describe, expect, it } from "vitest";
import { buildEactBytes } from "./container";

describe("buildEactBytes", () => {
  it("writes a consistent size field at 0x20 (little header, big-endian value)", () => {
    const bytes = buildEactBytes("T", [[0x41]]);
    const size =
      (bytes[0x20] << 24) | (bytes[0x21] << 16) | (bytes[0x22] << 8) | bytes[0x23];
    expect(size).toBe(bytes.length);
  });

  it("writes the bitwise-complement of the size at 0x10", () => {
    const bytes = buildEactBytes("T", [[0x41]]);
    const size =
      (bytes[0x20] << 24) | (bytes[0x21] << 16) | (bytes[0x22] << 8) | bytes[0x23];
    const comp =
      (bytes[0x10] << 24) | (bytes[0x11] << 16) | (bytes[0x12] << 8) | bytes[0x13];
    expect(comp >>> 0).toBe((~size) >>> 0);
  });

  it("emits the g2e/g1e subtype block identically, and diverges for g3e", () => {
    const g2e = buildEactBytes("T", [[0x41]], undefined, "g2e");
    const g1e = buildEactBytes("T", [[0x41]], undefined, "g1e");
    const g3e = buildEactBytes("T", [[0x41]], undefined, "g3e");
    expect(Array.from(g1e)).toEqual(Array.from(g2e));
    expect(g3e[0x2a]).toBe(0x04);
    expect(g2e[0x2a]).toBe(0x02);
  });

  it("grows the container as more/longer lines are added", () => {
    const one = buildEactBytes("T", [[0x41]]);
    const two = buildEactBytes("T", [[0x41], [0x42, 0x43, 0x44]]);
    expect(two.length).toBeGreaterThan(one.length);
  });
});
