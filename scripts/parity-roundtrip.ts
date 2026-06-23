// Round-trip parity: importing must be the byte-exact inverse of building.
// For every line/title we build a container, parse it back into markup, and
// rebuild — the bytes must be identical. This is the import contract: the
// reconstructed markup is lossy as text (²→^{2}, ½→\frac{1}{2}, subscripts→_{}),
// but re-encode()s to exactly the original bytes. See AGENTS.md.
//
// Run with: npx tsx scripts/parity-roundtrip.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildEact,
  parseEact,
  encode,
  decodeMarkup,
  splitlines,
  type EactFormat,
} from "../src/lib/casio/index";

const here = dirname(fileURLToPath(import.meta.url));
const INPUT = join(here, "..", "..", "casio-eactgen-py", "input.txt");

let failures = 0;
const pass = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  failures++;
};
const hex = (a: ArrayLike<number>) =>
  Array.from(a, (x) => x.toString(16).padStart(2, "0")).join(" ");

function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : Math.min(a.length, b.length);
}

const corpus = readFileSync(INPUT, "utf-8");

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

// 1) Per-line: decodeMarkup(encode(line)) must re-encode to the same bytes.
console.log("decodeMarkup() per-line byte round-trip:");
for (const literalSuper of [false, true]) {
  let bad = 0;
  const lines = [...splitlines(corpus), ...EXTRA];
  for (const ln of lines) {
    if (ln.startsWith("\\note{")) continue; // notes exercised by the full build
    const bytes = encode(ln, literalSuper);
    const { text } = decodeMarkup(bytes);
    const reencoded = encode(text, literalSuper);
    if (firstDiff(bytes, reencoded) !== -1) {
      bad++;
      if (bad <= 5)
        fail(
          `literalSuper=${literalSuper} ${JSON.stringify(ln)}\n     decoded=${JSON.stringify(text)}\n     orig =${hex(bytes)}\n     re   =${hex(reencoded)}`,
        );
    }
  }
  if (bad === 0)
    pass(`all ${lines.length} lines round-trip (literalSuper=${literalSuper})`);
}

// 2) Full container: buildEact -> parseEact -> buildEact must be byte-identical,
//    across every format, both superscript modes, several titles.
console.log("parseEact() full-container byte round-trip (input.txt):");
const FORMATS: EactFormat[] = ["g2e", "g1e", "g3e"];
for (const format of FORMATS) {
  for (const literalSuper of [false, true]) {
    for (const title of ["TDCF", "TEST", "AB", ""]) {
      const original = buildEact(title, corpus, { literalSuper, format });
      const parsed = parseEact(original);
      const rebuilt = buildEact(parsed.title, parsed.content, {
        literalSuper,
        format,
      });
      const at = firstDiff(original, rebuilt);
      const label = `format=${format} title=${JSON.stringify(title)} literalSuper=${literalSuper}`;
      if (at === -1) {
        if (parsed.format !== (format === "g3e" ? "g3e" : "g2e"))
          fail(`${label} — format mis-detected as ${parsed.format}`);
        else pass(`${label} — ${original.length} bytes, round-trips`);
      } else {
        fail(
          `${label} differ at byte 0x${at.toString(16)} (orig=${original.length}, rebuilt=${rebuilt.length})`,
        );
      }
    }
  }
}

console.log(
  failures === 0 ? "\nROUND-TRIP: PASS" : `\nROUND-TRIP: FAIL (${failures})`,
);
process.exit(failures === 0 ? 0 : 1);
