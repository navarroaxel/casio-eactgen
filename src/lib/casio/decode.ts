// Port of decode() from casio_translate.py (362-393).
// CASIO bytes -> readable Unicode (for the live preview pane).
//
// decodeMarkup() (below) is the import counterpart: unlike decode(), it
// reconstructs editable EactMaker markup (\frac, ^{}, _{}, …) so the result
// re-encode()s to the same bytes. It is the inverse of encodeRun() in encode.ts.
import { dec } from "./chars";
import {
  encode,
  EACT_OVERRIDE,
  RAW_SEQ,
  LEAD_BYTES,
  NABLA_CODE,
  POWER,
  SUP_OPEN,
  SUP_CLOSE,
} from "./encode";

export function decode(data: ArrayLike<number>, raw = false): string {
  const out: string[] = [];
  let i = 0;
  const n = data.length;
  while (i < n) {
    const b = data[i];
    let code: number;
    if (LEAD_BYTES.has(b) && i + 1 < n) {
      code = (b << 8) | data[i + 1];
      i += 2;
    } else {
      code = b;
      i += 1;
    }
    if (!raw && code === POWER) {
      out.push("^");
      continue;
    }
    if (!raw && code === SUP_OPEN) {
      out.push("(");
      continue;
    }
    if (!raw && code === SUP_CLOSE) {
      out.push(")");
      continue;
    }
    if (!raw && code === NABLA_CODE && !dec.has(code)) {
      out.push("∇");
      continue;
    }
    const s = dec.get(code);
    if (s !== undefined) out.push(s);
    else if (code >= 0x20 && code <= 0x7e) out.push(String.fromCharCode(code));
    else if (code === 0x00) out.push(raw ? "␀" : "");
    else
      out.push("\\x" + code.toString(16).padStart(code <= 0xff ? 2 : 4, "0"));
  }
  return out.join("");
}

// --- Structured markup decoder (import path) --------------------------------
//
// Inverse of encodeRun(). Structural opcodes double as display glyphs in the
// `dec` table (e.g. 0x8d -> "∫(", 0xbb -> "⌟"), so they are matched here by
// their *prefix shape* (a following 0x1d / 0x1a) before any table lookup; a
// bare 0x8d/0xbb falls through to the glyph. These literals mirror encode.ts.
const FRAC_LEAD = 0xbb;
const SQRT_LEAD = 0x86;
const ABS_LEAD = 0x97;
const STRUCT_OPEN = 0x1d; // FRAC/SQRT/ABS group open (FRAC_PREFIX[1])
const STRUCT_CLOSE = 0x1e; // FRAC_SUFFIX
const INT_OP = 0x8d;
const ARG_SEP = 0x1c;
const MAT_LEAD = 0x5d; // 0x7f 0x5d
const MAT_BRACE = 0xa4;
const MAT_END = 0xb4;

// code -> token for CASIO glyphs that have no (re-encodable) Unicode form.
const rawByCode = new Map<number, string>();
for (const [seq, code] of RAW_SEQ) if (!rawByCode.has(code)) rawByCode.set(code, seq);

// code -> the canonical source char EactMaker overrides to (∇ over ▽, α, +, ℇ).
// First insertion wins, so ∇ beats ▽ for shared code 0xe6da.
const overrideByCode = new Map<number, string>();
for (const [ch, code] of Object.entries(EACT_OVERRIDE))
  if (!overrideByCode.has(code)) overrideByCode.set(code, ch);

// dec entries restricted to those that verifiably re-encode to their own code
// (built lazily, once). Excludes astral/ambiguous glyphs — e.g. 0xcd decodes to
// "𝚛", which encode() can't reproduce, so it falls back to the \serifr; token.
let _safeDec: Map<number, string> | null = null;
function safeDec(): Map<number, string> {
  if (_safeDec) return _safeDec;
  const m = new Map<number, string>();
  for (const [code, s] of dec) {
    try {
      const b = encode(s, false);
      const ok =
        code > 0xff
          ? b.length === 2 && b[0] === code >> 8 && b[1] === (code & 0xff)
          : b.length === 1 && b[0] === code;
      if (ok) m.set(code, s);
    } catch {
      /* not re-encodable — leave to rawByCode / \xHH */
    }
  }
  _safeDec = m;
  return m;
}

/** A subscript byte pair, as emitted by emitSubscript() (digit/sign/letter). */
function subAt(data: number[], i: number): string | null {
  const b = data[i];
  const c = data[i + 1];
  if (c === undefined) return null;
  if (b === 0xe5) {
    if (c >= 0xd0 && c <= 0xd9) return String(c - 0xd0);
    if (c === 0xdb) return "+";
    if (c === 0xdc) return "-";
    return null;
  }
  if (b === 0xe7 && c < 0x80) return String.fromCharCode(c);
  return null;
}

/** data[i] must be 0x1a; return [inner, indexAfterClose], counting 0x1a/0x1b. */
function readGroup(data: number[], i: number): [number[], number] {
  let depth = 0;
  for (let j = i; j < data.length; j++) {
    if (data[j] === SUP_OPEN) depth += 1;
    else if (data[j] === SUP_CLOSE) {
      depth -= 1;
      if (depth === 0) return [data.slice(i + 1, j), j + 1];
    }
  }
  return [data.slice(i + 1), data.length]; // unbalanced: take the rest
}

/** Split on ARG_SEP (0x1c) at group-depth 0. */
function splitArgs(inner: number[]): number[][] {
  const parts: number[][] = [];
  let depth = 0;
  let start = 0;
  for (let j = 0; j < inner.length; j++) {
    const x = inner[j];
    if (x === SUP_OPEN) depth += 1;
    else if (x === SUP_CLOSE) depth -= 1;
    else if (x === ARG_SEP && depth === 0) {
      parts.push(inner.slice(start, j));
      start = j + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}

function readCode(data: number[], i: number): [number, number] {
  const b = data[i];
  if (LEAD_BYTES.has(b) && i + 1 < data.length)
    return [(b << 8) | data[i + 1], i + 2];
  return [b, i + 1];
}

interface DecodeState {
  lossy: boolean;
}

function decodeRun(data: number[], st: DecodeState): string {
  let out = "";
  let i = 0;
  const n = data.length;
  while (i < n) {
    const b = data[i];
    const c1 = data[i + 1];

    // Superscript: a8 1a … 1b
    if (b === POWER && c1 === SUP_OPEN) {
      const [inner, j] = readGroup(data, i + 1);
      out += "^{" + decodeRun(inner, st) + "}";
      i = j;
      continue;
    }
    // \frac{}{} : bb 1d [1a num 1b][1a den 1b] 1e
    if (b === FRAC_LEAD && c1 === STRUCT_OPEN) {
      const [num, j1] = readGroup(data, i + 2);
      const [den, j2] = readGroup(data, j1);
      out += "\\frac{" + decodeRun(num, st) + "}{" + decodeRun(den, st) + "}";
      i = data[j2] === STRUCT_CLOSE ? j2 + 1 : j2;
      continue;
    }
    // \sqrt{} : 86 1d [1a body 1b] 1e
    if (b === SQRT_LEAD && c1 === STRUCT_OPEN) {
      const [body, j1] = readGroup(data, i + 2);
      out += "\\sqrt{" + decodeRun(body, st) + "}";
      i = data[j1] === STRUCT_CLOSE ? j1 + 1 : j1;
      continue;
    }
    // \abs{} : 97 1d [1a body 1b] 1e
    if (b === ABS_LEAD && c1 === STRUCT_OPEN) {
      const [body, j1] = readGroup(data, i + 2);
      out += "\\abs{" + decodeRun(body, st) + "}";
      i = data[j1] === STRUCT_CLOSE ? j1 + 1 : j1;
      continue;
    }
    // \int{A}{B}{C} : 8d 1a C 1c B 1c A 1b
    if (b === INT_OP && c1 === SUP_OPEN) {
      const [inner, j] = readGroup(data, i + 1);
      const [pc, pb, pa] = splitArgs(inner);
      out +=
        "\\int{" +
        decodeRun(pa ?? [], st) +
        "}{" +
        decodeRun(pb ?? [], st) +
        "}{" +
        decodeRun(pc ?? [], st) +
        "}";
      i = j;
      continue;
    }
    // 0x7f-led structures (0x7f is a lead byte, so peek the second byte raw).
    if (b === 0x7f) {
      const c2 = data[i + 2];
      if (c1 === 0x85 && c2 === SUP_OPEN) {
        const [inner, j] = readGroup(data, i + 2);
        const [pa, pb] = splitArgs(inner);
        out +=
          "\\log{" + decodeRun(pa ?? [], st) + "}{" + decodeRun(pb ?? [], st) + "}";
        i = j;
        continue;
      }
      if ((c1 === 0x26 || c1 === 0x27) && c2 === SUP_OPEN) {
        const [inner, j] = readGroup(data, i + 2);
        const [pa, pb] = splitArgs(inner);
        const name = c1 === 0x27 ? "diff2" : "diff";
        out +=
          "\\" + name + "{" + decodeRun(pa ?? [], st) + "}{" + decodeRun(pb ?? [], st) + "}";
        i = j;
        continue;
      }
      if (c1 === 0x29 && c2 === SUP_OPEN) {
        const [inner, j] = readGroup(data, i + 2);
        const p = splitArgs(inner); // [expr, var, start, count]
        out +=
          "\\sum{" +
          decodeRun(p[3] ?? [], st) +
          "}{" +
          decodeRun(p[1] ?? [], st) +
          "}{" +
          decodeRun(p[2] ?? [], st) +
          "}{" +
          decodeRun(p[0] ?? [], st) +
          "}";
        i = j;
        continue;
      }
      // \mat : 7f 5d a4 (a4 <cells> b4)* b4. Flat matrices only.
      if (c1 === MAT_LEAD && c2 === MAT_BRACE) {
        let j = i + 3;
        const rows: string[] = [];
        while (j < n && data[j] === MAT_BRACE) {
          j += 1;
          const start = j;
          while (j < n && data[j] !== MAT_END) j += 1;
          const row = data.slice(start, j);
          if (j < n) j += 1; // consume b4
          rows.push(splitArgs(row).map((cell) => decodeRun(cell, st)).join("&"));
        }
        if (j < n && data[j] === MAT_END) j += 1; // trailing b4
        out += "\\mat" + rows.map((r) => "{" + r + "}").join("");
        i = j;
        continue;
      }
    }
    // Subscript run: group consecutive sub-pairs into one _{…}.
    if (subAt(data, i) !== null) {
      let body = "";
      let s: string | null;
      while (i < n && (s = subAt(data, i)) !== null) {
        body += s;
        i += 2;
      }
      out += "_{" + body + "}";
      continue;
    }

    // Plain code: override (∇/α/+) -> verified Unicode -> raw token -> ASCII.
    const [code, ni] = readCode(data, i);
    i = ni;
    if (code === 0x00) continue;
    const ov = overrideByCode.get(code);
    if (ov !== undefined) {
      out += ov;
      continue;
    }
    const sd = safeDec().get(code);
    if (sd !== undefined) {
      out += sd;
      continue;
    }
    const rw = rawByCode.get(code);
    if (rw !== undefined) {
      out += rw;
      continue;
    }
    if (code >= 0x20 && code <= 0x7e) {
      out += String.fromCharCode(code);
      continue;
    }
    if (code === NABLA_CODE) {
      out += "∇";
      continue;
    }
    st.lossy = true;
    out += "\\x" + code.toString(16).padStart(code <= 0xff ? 2 : 4, "0");
  }
  return out;
}

/**
 * Reconstruct editable EactMaker markup from a cell's CASIO bytes (inverse of
 * encodeRun). The result re-encode()s to the same bytes, but is lossy as text:
 * `²`→`^{2}`, `½`→`\frac{1}{2}`, subscripts→`_{}`, override glyphs→their source
 * char. `lossy` is true if any byte had no markup form (emitted as `\xHH`).
 */
export function decodeMarkup(data: ArrayLike<number>): {
  text: string;
  lossy: boolean;
} {
  const st: DecodeState = { lossy: false };
  const text = decodeRun(Array.from(data), st);
  return { text, lossy: st.lossy };
}
