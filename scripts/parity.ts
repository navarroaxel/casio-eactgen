// Parity check: the TS encoder must produce byte-identical output to the
// reference Python implementation (casio_translate.py), which is itself
// verified byte-identical to EactMaker.
//
// Run with: npx tsx scripts/parity.ts
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEact, encode, splitlines } from "../src/lib/casio/index";

const here = dirname(fileURLToPath(import.meta.url));
const PY_DIR = join(here, "..", "..", "casio-eactgen-py");
const PY = join(PY_DIR, "casio_translate.py");
const INPUT = join(PY_DIR, "input.txt");

let failures = 0;
const pass = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  failures++;
};

function pyEncode(text: string, literalSuper: boolean): number[] {
  const args = ["encode", text];
  if (literalSuper) args.push("--literal-super");
  const out = execFileSync("python3", [PY, ...args], { encoding: "utf-8" });
  const hexLine = out.split("\n")[0].trim();
  if (hexLine === "") return [];
  return hexLine.split(/\s+/).map((h) => parseInt(h, 16));
}

function pyBuild(title: string, literalSuper: boolean): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), "parity-"));
  const outPath = join(dir, "out.g2e");
  const args = ["build", INPUT, "--title", title, "-o", outPath];
  if (literalSuper) args.push("--literal-super");
  execFileSync("python3", [PY, ...args], { encoding: "utf-8" });
  return new Uint8Array(readFileSync(outPath));
}

function eqBytes(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : Math.min(a.length, b.length);
}

// 1) Per-line encode() parity over every line of input.txt (both super modes).
console.log("encode() per-line parity (input.txt):");
const lines = splitlines(readFileSync(INPUT, "utf-8"));
for (const literalSuper of [false, true]) {
  let bad = 0;
  for (const ln of lines) {
    if (ln.startsWith("\\note{")) continue; // notes are exercised by the full build
    const mine = encode(ln, literalSuper);
    const ref = pyEncode(ln, literalSuper);
    if (eqBytes(mine, ref) !== -1) {
      bad++;
      if (bad <= 3)
        fail(
          `literalSuper=${literalSuper} line ${JSON.stringify(ln)}\n     mine=${mine.map((x) => x.toString(16)).join(" ")}\n     ref =${ref.map((x) => x.toString(16)).join(" ")}`,
        );
    }
  }
  if (bad === 0)
    pass(`all ${lines.length} lines match (literalSuper=${literalSuper})`);
}

// 2) Full-file build parity (the whole container, incl. notes + header).
console.log("buildEact() full-file parity (input.txt):");
for (const literalSuper of [false, true]) {
  for (const title of ["TDCF", "TEST", "AB", ""]) {
    const mine = buildEact(title, readFileSync(INPUT, "utf-8"), {
      literalSuper,
    });
    const ref = pyBuild(title, literalSuper);
    const at = eqBytes(mine, ref);
    if (at === -1)
      pass(
        `title=${JSON.stringify(title)} literalSuper=${literalSuper} — ${mine.length} bytes identical`,
      );
    else {
      fail(
        `title=${JSON.stringify(title)} literalSuper=${literalSuper} differ at byte 0x${at.toString(16)} (mine=${mine.length}, ref=${ref.length})`,
      );
      writeFileSync(join(tmpdir(), "mine.g2e"), mine);
      writeFileSync(join(tmpdir(), "ref.g2e"), ref);
    }
  }
}

console.log(failures === 0 ? "\nPARITY: PASS" : `\nPARITY: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
