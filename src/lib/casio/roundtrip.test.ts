// Round-trip parity: importing must be the byte-exact inverse of building.
// For every line/title we build a container, parse it back into markup, and
// rebuild — the bytes must be identical. This is the import contract: the
// reconstructed markup is lossy as text (²→^{2}, ½→\frac{1}{2}, subscripts→_{}),
// but re-encode()s to exactly the original bytes. See AGENTS.md.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildEact,
  parseEact,
  encode,
  decodeMarkup,
  splitlines,
  type EactFormat,
} from "./index";

const corpus = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "scripts",
    "fixtures",
    "input.txt",
  ),
  "utf-8",
);

// Synthetic lines for markup not present in input.txt (\log \diff \sum \mat \abs).
const EXTRA = [
  "\\log{2}{8}",
  "\\diff{x^2}{x}",
  "\\diff2{y}{x}",
  "\\sum{10}{k}{1}{k^2}",
  "\\abs{x-1}",
  "\\mat{1&2}{3&4}",
  "a_{ij}+b_n+\\frac{1}{2}^{3}",
];

const LINES = [...splitlines(corpus), ...EXTRA].filter(
  (ln) => !ln.startsWith("\\note{"), // notes are exercised by the full-container round trip
);

describe("decodeMarkup() per-line byte round-trip", () => {
  for (const literalSuper of [false, true]) {
    it.each(LINES)(`literalSuper=${literalSuper} %s`, (line) => {
      const bytes = encode(line, literalSuper);
      const { text } = decodeMarkup(bytes);
      expect(encode(text, literalSuper)).toEqual(bytes);
    });
  }
});

const FORMATS: EactFormat[] = ["g2e", "g1e", "g3e"];
const TITLES = ["TDCF", "TEST", "AB", ""];

describe("parseEact() full-container byte round-trip", () => {
  for (const format of FORMATS) {
    for (const literalSuper of [false, true]) {
      for (const title of TITLES) {
        it(`format=${format} title=${JSON.stringify(title)} literalSuper=${literalSuper}`, () => {
          const original = buildEact(title, corpus, { literalSuper, format });
          const parsed = parseEact(original);
          expect(parsed.format).toBe(format === "g3e" ? "g3e" : "g2e");
          const rebuilt = buildEact(parsed.title, parsed.content, {
            literalSuper,
            format,
          });
          expect(Array.from(rebuilt)).toEqual(Array.from(original));
        });
      }
    }
  }
});
