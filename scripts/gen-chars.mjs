#!/usr/bin/env node
/*
 * gen-chars.mjs — build the CASIO character maps used by the encoder/decoder.
 *
 * Faithful port of load_table() + build_maps() from
 *   ../casio-eactgen-py/casio_translate.py  (lines 85-130)
 *
 * Reads the Cahute character table (chars.toml, by Thomas Touhey, CeCILL 2.1)
 * and emits src/lib/casio/chars.generated.json:
 *   enc: { "<char>": code }   single-codepoint glyphs only (for encoding)
 *   dec: { "<code>": "<str>" } code -> unicode string      (for decoding/preview)
 *
 * Run with: npm run gen:chars
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOML_PATH = join(__dirname, "..", "..", "casio-eactgen-py", "chars.toml");
const OUT_PATH = join(
  __dirname,
  "..",
  "src",
  "lib",
  "casio",
  "chars.generated.json",
);

function tomlInt(s) {
  if (s == null) return null;
  s = s.trim();
  const v = s.toLowerCase().startsWith("0x")
    ? parseInt(s, 16)
    : parseInt(s, 10);
  return Number.isNaN(v) ? null : v;
}

// Mirror of Python _unicode_str: `unicode` is a list literal of codepoints,
// e.g. "[0x3BC]" or "[0x66, 0x2081]". Returns the joined string, or null.
function unicodeStr(entry) {
  const u = entry.unicode;
  if (!u) return null;
  const m = u.match(/-?(?:0x[0-9a-fA-F]+|\d+)/g);
  if (!m) return null;
  try {
    return m
      .map((tok) =>
        tok.toLowerCase().startsWith("0x")
          ? parseInt(tok, 16)
          : parseInt(tok, 10),
      )
      .map((cp) => String.fromCodePoint(cp))
      .join("");
  } catch {
    return null;
  }
}

function loadTable(txt) {
  const entries = [];
  const blocks = txt.split("[[chars]]").slice(1);
  for (const block of blocks) {
    const e = {};
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*(?:#.*)?$/);
      if (m) {
        let val = m[2].trim();
        if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
          val = val.slice(1, -1);
        }
        e[m[1]] = val;
      }
    }
    entries.push(e);
  }
  return entries;
}

// rank: lower = preferred for the encode map (9860 -> base -> legacy)
function rank(e) {
  const t = e.table;
  if (t === "9860") return 0;
  if (t == null) return 1;
  return 2;
}

function buildMaps(entries) {
  const dec = {};
  const enc = {};
  // stable sort by rank
  const sorted = entries
    .map((e, i) => [e, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([e]) => e);
  for (const e of sorted) {
    const code = tomlInt(e.code_9860) ?? tomlInt(e.code);
    if (code == null) continue;
    const s = unicodeStr(e);
    // decode map: keep first writer per code, but let 9860 override
    if (!(code in dec) || e.table === "9860") {
      if (s != null) dec[code] = s;
    }
    // encode map: only single-codepoint glyphs, first (best-ranked) wins
    if (s != null && [...s].length === 1 && !(s in enc)) {
      enc[s] = code;
    }
  }
  return { dec, enc };
}

const txt = readFileSync(TOML_PATH, "utf-8");
const entries = loadTable(txt);
const { dec, enc } = buildMaps(entries);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify({ enc, dec }, null, 0) + "\n");

console.log(`Parsed ${entries.length} char blocks`);
console.log(
  `enc: ${Object.keys(enc).length} entries, dec: ${Object.keys(dec).length} entries`,
);
// spot-checks against casio_translate.py header notes
const show = (ch) =>
  console.log(`  ${ch} -> 0x${(enc[ch] ?? 0).toString(16).toUpperCase()}`);
["ε", "μ", "π", "θ"].forEach(show);
console.log(`Wrote ${OUT_PATH}`);
