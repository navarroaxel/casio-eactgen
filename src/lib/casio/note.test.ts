import { describe, expect, it } from "vitest";
import { buildNoteContent, parseNoteContent } from "./note";
import { encode } from "./encode";

describe("buildNoteContent / parseNoteContent", () => {
  it("recovers the original title and body byte runs", () => {
    const title = encode("Note title");
    const body = encode("Line one\nLine two");
    const cell = buildNoteContent(title, body);
    const { titleBytes, bodyBytes } = parseNoteContent(cell);

    // Title comes back padded with trailing zero bytes (padding lives inside
    // the marker-delimited region). The body run may be preceded by a few
    // zero bytes of slop — harmless because decodeMarkup() drops 0x00 — but
    // its tail must match exactly.
    expect(titleBytes.slice(0, title.length)).toEqual(title);
    expect(titleBytes.slice(title.length).every((b) => b === 0)).toBe(true);
    expect(bodyBytes.slice(bodyBytes.length - body.length)).toEqual(body);
    expect(bodyBytes.slice(0, bodyBytes.length - body.length).every((b) => b === 0)).toBe(
      true,
    );
  });

  it("round-trips an empty title and body (only zero slop remains)", () => {
    const cell = buildNoteContent([], []);
    const { titleBytes, bodyBytes } = parseNoteContent(cell);
    expect(titleBytes.every((b) => b === 0)).toBe(true);
    expect(bodyBytes.every((b) => b === 0)).toBe(true);
  });
});
