// Public API for the CASIO eActivity generator (browser-friendly, no Node deps).
import { encodeLine } from "./encode";
import { buildEactBytes } from "./container";

export { encode, encodeLine } from "./encode";
export { decode, decodeMarkup } from "./decode";
export { parseEact, type ParsedEact } from "./parse";
export { enc, dec } from "./chars";

export type EactFormat = "g2e" | "g1e" | "g3e";

export interface BuildOptions {
  /** Encode ² ³ as the power form (a8 1a..1b) instead of the text glyph. */
  literalSuper?: boolean;
  /** Container subtype to emit. Defaults to "g2e". */
  format?: EactFormat;
}

/** Mirror of Python str.splitlines(): a single trailing newline yields no extra line. */
export function splitlines(s: string): string[] {
  if (s === "") return [];
  const lines = s.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "" && /[\r\n]$/.test(s)) {
    lines.pop();
  }
  return lines;
}

/**
 * Build a CASIO eActivity file from a title and multi-line text body.
 * Returns the raw bytes. .g1e and .g2e are byte-identical here (extension only);
 * .g3e (fx-CG / Prizm) differs only in a fixed prefix subtype block.
 */
export function buildEact(
  title: string,
  text: string,
  opts: BuildOptions = {},
): Uint8Array {
  const literalSuper = opts.literalSuper ?? false;
  const lines = splitlines(text);
  const pairs = lines.map((ln) => encodeLine(ln, literalSuper));
  return buildEactBytes(
    title.slice(0, 8),
    pairs.map((p) => p[0]),
    pairs.map((p) => p[1]),
    opts.format ?? "g2e",
  );
}
