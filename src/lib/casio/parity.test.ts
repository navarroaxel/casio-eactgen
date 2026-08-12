// Parity: the TS encoder must produce byte-identical output to the reference
// Python implementation (casio_translate.py), which is itself verified
// byte-identical to EactMaker.
//
// Diffs against scripts/fixtures/parity.json — a frozen recording of the
// Python reference's output for scripts/fixtures/input.txt — rather than
// invoking python3/casio-eactgen-py live, so this needs no external
// dependency. Regenerate the fixture with `npm run gen:fixtures` after
// changing casio_translate.py or the test corpus. See AGENTS.md.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEact, encode, type EactFormat } from "./index";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "scripts",
  "fixtures",
);
const corpus = readFileSync(join(fixturesDir, "input.txt"), "utf-8");

interface Fixtures {
  lines: { line: string; literalSuper: boolean; bytesB64: string }[];
  containers: {
    format: EactFormat;
    title: string;
    literalSuper: boolean;
    bytesB64: string;
  }[];
}
const fixtures: Fixtures = JSON.parse(
  readFileSync(join(fixturesDir, "parity.json"), "utf-8"),
);
const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

describe("encode() per-line parity vs the Python reference", () => {
  it.each(fixtures.lines)(
    "literalSuper=$literalSuper $line",
    ({ line, literalSuper, bytesB64 }) => {
      expect(encode(line, literalSuper)).toEqual(Array.from(fromB64(bytesB64)));
    },
  );
});

describe("buildEact() full-container parity vs the Python reference", () => {
  it.each(fixtures.containers)(
    "format=$format title=$title literalSuper=$literalSuper",
    ({ format, title, literalSuper, bytesB64 }) => {
      const mine = buildEact(title, corpus, { literalSuper, format });
      expect(Array.from(mine)).toEqual(Array.from(fromB64(bytesB64)));
    },
  );
});
