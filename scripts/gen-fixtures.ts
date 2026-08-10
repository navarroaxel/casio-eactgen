// gen-fixtures.ts — record the Python reference's output for the committed
// test corpus (scripts/fixtures/input.txt) into scripts/fixtures/parity.json.
//
// This lets parity.ts run without python3 or a ../casio-eactgen-py checkout:
// it diffs the TS encoder against these frozen bytes instead of calling the
// Python script live. Re-run this generator (which *does* need the sibling
// repo) whenever casio_translate.py or scripts/fixtures/input.txt changes.
//
// Run with: npm run gen:fixtures
// Override the Python script location with CASIO_PY=<path-to-casio_translate.py>.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { splitlines, type EactFormat } from "../src/lib/casio/index";

const here = dirname(fileURLToPath(import.meta.url));
const PY =
  process.env.CASIO_PY ||
  join(here, "..", "..", "casio-eactgen-py", "casio_translate.py");
const INPUT = join(here, "fixtures", "input.txt");
const OUT = join(here, "fixtures", "parity.json");

function b64(bytes: Uint8Array | number[]): string {
  return Buffer.from(bytes).toString("base64");
}

function pyEncode(text: string, literalSuper: boolean): number[] {
  const args = ["encode", text];
  if (literalSuper) args.push("--literal-super");
  const out = execFileSync("python3", [PY, ...args], { encoding: "utf-8" });
  const hexLine = out.split("\n")[0].trim();
  if (hexLine === "") return [];
  return hexLine.split(/\s+/).map((h) => parseInt(h, 16));
}

function pyBuild(
  title: string,
  literalSuper: boolean,
  format: EactFormat,
): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), "gen-fixtures-"));
  const outPath = join(dir, `out.${format}`);
  const args = ["build", INPUT, "--title", title, "--format", format, "-o", outPath];
  if (literalSuper) args.push("--literal-super");
  execFileSync("python3", [PY, ...args], { encoding: "utf-8" });
  return new Uint8Array(readFileSync(outPath));
}

const lines = splitlines(readFileSync(INPUT, "utf-8"));
const FORMATS: EactFormat[] = ["g2e", "g1e", "g3e"];
const TITLES = ["TDCF", "TEST", "AB", ""];

console.log(`Recording Python reference output for ${lines.length} lines...`);
const lineFixtures: { line: string; literalSuper: boolean; bytesB64: string }[] = [];
for (const literalSuper of [false, true]) {
  for (const line of lines) {
    if (line.startsWith("\\note{")) continue; // notes are exercised by the full build
    lineFixtures.push({
      line,
      literalSuper,
      bytesB64: b64(pyEncode(line, literalSuper)),
    });
  }
}

console.log("Recording Python reference container builds...");
const containerFixtures: {
  format: EactFormat;
  title: string;
  literalSuper: boolean;
  bytesB64: string;
}[] = [];
for (const format of FORMATS) {
  for (const literalSuper of [false, true]) {
    for (const title of TITLES) {
      containerFixtures.push({
        format,
        title,
        literalSuper,
        bytesB64: b64(pyBuild(title, literalSuper, format)),
      });
    }
  }
}

writeFileSync(
  OUT,
  JSON.stringify({ lines: lineFixtures, containers: containerFixtures }, null, 1) + "\n",
);
console.log(`Wrote ${OUT}`);
