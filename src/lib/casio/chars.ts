// Character maps generated from the Cahute chars.toml at build time.
// Regenerate with `npm run gen:chars` (see scripts/gen-chars.mjs).
import data from "./chars.generated.json";

/** Single-codepoint glyph -> CASIO FONTCHARACTER code (for encoding). */
export const enc: Record<string, number> = data.enc;

/** CASIO code -> Unicode string (for decoding / preview). */
const decRaw: Record<string, string> = data.dec;
export const dec: Map<number, string> = new Map(
  Object.entries(decRaw).map(([k, v]) => [Number(k), v]),
);
