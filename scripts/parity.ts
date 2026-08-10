// Parity check: the TS encoder must produce byte-identical output to the
// reference Python implementation (casio_translate.py), which is itself
// verified byte-identical to EactMaker.
//
// This diffs against scripts/fixtures/parity.json — a frozen recording of the
// Python reference's output for scripts/fixtures/input.txt — rather than
// invoking python3/casio-eactgen-py live, so it needs no external dependency.
// Regenerate the fixture with `npm run gen:fixtures` after changing
// casio_translate.py or the test corpus.
//
// Run with: npx tsx scripts/parity.ts
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEact, encode, type EactFormat } from "../src/lib/casio/index";

const here = dirname(fileURLToPath(import.meta.url));
const INPUT = join(here, "fixtures", "input.txt");
const FIXTURES = join(here, "fixtures", "parity.json");

interface Fixtures {
  lines: { line: string; literalSuper: boolean; bytesB64: string }[];
  containers: {
    format: EactFormat;
    title: string;
    literalSuper: boolean;
    bytesB64: string;
  }[];
}

const fixtures: Fixtures = JSON.parse(readFileSync(FIXTURES, "utf-8"));
const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

let failures = 0;
const pass = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  failures++;
};

function eqBytes(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : Math.min(a.length, b.length);
}

// 1) Per-line encode() parity over every line of input.txt (both super modes).
console.log("encode() per-line parity (input.txt):");
for (const literalSuper of [false, true]) {
  const forMode = fixtures.lines.filter((f) => f.literalSuper === literalSuper);
  let bad = 0;
  for (const { line, bytesB64 } of forMode) {
    const mine = encode(line, literalSuper);
    const ref = fromB64(bytesB64);
    if (eqBytes(mine, ref) !== -1) {
      bad++;
      if (bad <= 3)
        fail(
          `literalSuper=${literalSuper} line ${JSON.stringify(line)}\n     mine=${mine.map((x) => x.toString(16)).join(" ")}\n     ref =${Array.from(ref, (x) => x.toString(16)).join(" ")}`,
        );
    }
  }
  if (bad === 0)
    pass(`all ${forMode.length} lines match (literalSuper=${literalSuper})`);
}

// 2) Full-file build parity (the whole container, incl. notes + header),
//    across every supported container format.
console.log("buildEact() full-file parity (input.txt):");
const corpus = readFileSync(INPUT, "utf-8");
for (const { format, title, literalSuper, bytesB64 } of fixtures.containers) {
  const mine = buildEact(title, corpus, { literalSuper, format });
  const ref = fromB64(bytesB64);
  const at = eqBytes(mine, ref);
  if (at === -1)
    pass(
      `format=${format} title=${JSON.stringify(title)} literalSuper=${literalSuper} — ${mine.length} bytes identical`,
    );
  else {
    fail(
      `format=${format} title=${JSON.stringify(title)} literalSuper=${literalSuper} differ at byte 0x${at.toString(16)} (mine=${mine.length}, ref=${ref.length})`,
    );
    writeFileSync(join(tmpdir(), `mine.${format}`), mine);
    writeFileSync(join(tmpdir(), `ref.${format}`), ref);
  }
}

console.log(failures === 0 ? "\nPARITY: PASS" : `\nPARITY: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
