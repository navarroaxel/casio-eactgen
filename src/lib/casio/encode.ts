// Port of the encoder in casio-eactgen-py/casio_translate.py (lines 132-360).
// Converts Unicode text + EactMaker markup into CASIO FONTCHARACTER bytes.
import { enc } from "./chars";
import { buildNoteContent } from "./note";

export const LEAD_BYTES = new Set([0x7f, 0xe5, 0xe6, 0xe7, 0xf7, 0xf9]);
export const NABLA_CODE = 0xd8; // del/nabla in TDCF.G1E
export const POWER = 0xa8; // FONTCHARACTER "Power" ( ^ )
export const SUP_OPEN = 0x1a;
export const SUP_CLOSE = 0x1b;
const FRAC_PREFIX = [0xbb, 0x1d];
const FRAC_SUFFIX = [0x1e];
const GROUP_OPEN = 0x1a;
const GROUP_CLOSE = 0x1b;
const SQRT = 0x86; // FONTCHARACTER "Square Root"

// Unicode "vulgar fraction" glyphs -> (numerator, denominator) strings.
const VULGAR: Record<string, [string, string]> = {
  "½": ["1", "2"],
  "⅓": ["1", "3"],
  "⅔": ["2", "3"],
  "¼": ["1", "4"],
  "¾": ["3", "4"],
  "⅕": ["1", "5"],
  "⅖": ["2", "5"],
  "⅗": ["3", "5"],
  "⅘": ["4", "5"],
  "⅙": ["1", "6"],
  "⅚": ["5", "6"],
  "⅛": ["1", "8"],
  "⅜": ["3", "8"],
  "⅝": ["5", "8"],
  "⅞": ["7", "8"],
  "⅐": ["1", "7"],
  "⅑": ["1", "9"],
  "⅒": ["1", "10"],
};

// LaTeX-style names for symbols hard to type. Applied longest-first.
const LATEX: Record<string, string> = {
  "\\nabla": "∇",
  "\\del": "∇",
  "\\partial": "∂",
  "\\alpha": "α",
  "\\beta": "β",
  "\\gamma": "γ",
  "\\delta": "δ",
  "\\epsilon": "ε",
  "\\varepsilon": "ε",
  "\\zeta": "ζ",
  "\\eta": "η",
  "\\theta": "θ",
  "\\iota": "ι",
  "\\kappa": "κ",
  "\\lambda": "λ",
  "\\mu": "μ",
  "\\nu": "ν",
  "\\xi": "ξ",
  "\\pi": "π",
  "\\rho": "ρ",
  "\\sigma": "σ",
  "\\tau": "τ",
  "\\phi": "φ",
  "\\chi": "χ",
  "\\psi": "ψ",
  "\\omega": "ω",
  "\\Gamma": "Γ",
  "\\Delta": "Δ",
  "\\Theta": "Θ",
  "\\Lambda": "Λ",
  "\\Pi": "Π",
  "\\Sigma": "Σ",
  "\\Phi": "Φ",
  "\\Omega": "Ω",
  "\\bolde;": "ℇ",
  "\\infty": "∞",
  "\\times": "×",
  "\\div": "÷",
  "\\le": "≤",
  "\\ge": "≥",
  "\\ne": "≠",
  "\\degree": "°",
};

const SUPERS: Record<string, string> = {
  "²": "2",
  "³": "3",
  "¹": "1",
  "⁰": "0",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  ⁿ: "n",
};

// EactMaker uses specific FONTCHARACTER codes that differ from the table default.
const EACT_OVERRIDE: Record<string, number> = {
  "∇": 0xe6da, // nabla -> White Down-Pointing Triangle glyph
  "▽": 0xe6da,
  "+": 0x89, // Addition token (not ASCII 0x2B)
  ℇ: 0xe5b0, // Euler constant (\bolde;)
  // chars.toml maps E640 ("Greek Small Letter Alpha") to U+0251 (Latin ɑ), not
  // the Greek α (U+03B1), so plain α has no table entry — fix it here.
  α: 0xe640,
};

/** text[i] must be "{"; return [inner, indexAfterClosingBrace], brace-balanced. */
function readGroup(text: string, i: number): [string, number] {
  if (text[i] !== "{") throw new Error("expected { at position " + i);
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    if (text[j] === "{") depth += 1;
    else if (text[j] === "}") {
      depth -= 1;
      if (depth === 0) return [text.slice(i + 1, j), j + 1];
    }
  }
  throw new Error("unbalanced { } in markup");
}

/** Stacked fraction: BB 1D [1A num 1B][1A den 1B] 1E. Fixes the missing
 *  _emit_fraction() in the Python (referenced but never defined). */
function emitFraction(
  num: string,
  den: string,
  out: number[],
  literalSuper: boolean,
): void {
  out.push(...FRAC_PREFIX);
  out.push(GROUP_OPEN, ...encodeRun(num, literalSuper), GROUP_CLOSE);
  out.push(GROUP_OPEN, ...encodeRun(den, literalSuper), GROUP_CLOSE);
  out.push(...FRAC_SUFFIX);
}

function emitChar(ch: string, out: number[], literalSuper: boolean): void {
  if (ch in VULGAR) {
    const [num, den] = VULGAR[ch];
    emitFraction(num, den, out, literalSuper);
    return;
  }
  if (ch in EACT_OVERRIDE) {
    const code = EACT_OVERRIDE[ch];
    if (code > 0xff) out.push(code >> 8, code & 0xff);
    else out.push(code);
    return;
  }
  if (ch in SUPERS && literalSuper) {
    out.push(POWER);
    out.push(SUP_OPEN, ...encodeRun(SUPERS[ch], false), SUP_CLOSE);
    return;
  }
  const o = ch.codePointAt(0)!;
  let code: number;
  if (o >= 0x20 && o <= 0x7e)
    code = o; // printable ASCII -> itself
  else if (ch in enc) code = enc[ch];
  else
    throw new Error(
      `no CASIO mapping for U+${o.toString(16).toUpperCase()} ${ch}`,
    );
  if (code > 0xff) out.push(code >> 8, code & 0xff);
  else out.push(code);
}

/** Subscript run: digit -> E5(D0+d), +/- -> E5 DB/DC, letter -> E7|ord. */
function emitSubscript(text: string, out: number[]): void {
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") out.push(0xe5, 0xd0 + Number(ch));
    else if (ch === "+" || ch === "-") out.push(0xe5, ch === "+" ? 0xdb : 0xdc);
    else if (ch.codePointAt(0)! < 0x80) out.push(0xe7, ch.codePointAt(0)!);
    else throw new Error(`no subscript form for ${ch}`);
  }
}

/** Parse EactMaker markup over `text` -> array of CASIO bytes (recursive). */
function encodeRun(text: string, literalSuper: boolean): number[] {
  const out: number[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text.startsWith("\\frac{", i)) {
      const [num, j] = readGroup(text, i + 5);
      if (j >= n || text[j] !== "{")
        throw new Error("\\frac{a}{b} needs a second {..} group");
      const [den, k] = readGroup(text, j);
      i = k;
      out.push(...FRAC_PREFIX);
      out.push(GROUP_OPEN, ...encodeRun(num, literalSuper), GROUP_CLOSE);
      out.push(GROUP_OPEN, ...encodeRun(den, literalSuper), GROUP_CLOSE);
      out.push(...FRAC_SUFFIX);
      continue;
    }
    if (text.startsWith("\\sqrt{", i)) {
      const [body, j] = readGroup(text, i + 5);
      i = j;
      out.push(
        SQRT,
        0x1d,
        GROUP_OPEN,
        ...encodeRun(body, literalSuper),
        GROUP_CLOSE,
      );
      out.push(...FRAC_SUFFIX);
      continue;
    }
    if (text.startsWith("\\int{", i)) {
      const [a, j1] = readGroup(text, i + 4);
      const [b, j2] = readGroup(text, j1);
      const [c, j3] = readGroup(text, j2);
      i = j3;
      // 8d 1a <integrand C> 1c <bound B> 1c <A> 1b
      out.push(0x8d, GROUP_OPEN);
      out.push(...encodeRun(c, literalSuper), 0x1c);
      out.push(...encodeRun(b, literalSuper), 0x1c);
      out.push(...encodeRun(a, literalSuper), GROUP_CLOSE);
      continue;
    }
    if (text.startsWith("\\abs{", i)) {
      const [body, j] = readGroup(text, i + 4);
      i = j;
      out.push(
        0x97,
        0x1d,
        GROUP_OPEN,
        ...encodeRun(body, literalSuper),
        GROUP_CLOSE,
        0x1e,
      );
      continue;
    }
    if (text.startsWith("\\log{", i)) {
      const [a, j1] = readGroup(text, i + 4);
      const [b, j2] = readGroup(text, j1);
      i = j2;
      out.push(0x7f, 0x85, GROUP_OPEN, ...encodeRun(a, literalSuper));
      out.push(0x1c, ...encodeRun(b, literalSuper), GROUP_CLOSE);
      continue;
    }
    if (text.startsWith("\\diff2{", i)) {
      const [a, j1] = readGroup(text, i + 6);
      const [b, j2] = readGroup(text, j1);
      i = j2;
      out.push(0x7f, 0x27, GROUP_OPEN, ...encodeRun(a, literalSuper));
      out.push(0x1c, ...encodeRun(b, literalSuper), GROUP_CLOSE);
      continue;
    }
    if (text.startsWith("\\diff{", i)) {
      const [a, j1] = readGroup(text, i + 5);
      const [b, j2] = readGroup(text, j1);
      i = j2;
      out.push(0x7f, 0x26, GROUP_OPEN, ...encodeRun(a, literalSuper));
      out.push(0x1c, ...encodeRun(b, literalSuper), GROUP_CLOSE);
      continue;
    }
    if (text.startsWith("\\sum{", i)) {
      const [count, j1] = readGroup(text, i + 4);
      const [varName, j2] = readGroup(text, j1);
      const [start, j3] = readGroup(text, j2);
      const [expr, j4] = readGroup(text, j3);
      i = j4;
      // 7f29 1a <expr> 1c <var> 1c <start> 1c <count> 1b
      out.push(0x7f, 0x29, GROUP_OPEN, ...encodeRun(expr, literalSuper));
      out.push(0x1c, ...encodeRun(varName, literalSuper));
      out.push(0x1c, ...encodeRun(start, literalSuper));
      out.push(0x1c, ...encodeRun(count, literalSuper), GROUP_CLOSE);
      continue;
    }
    if (text.startsWith("\\mat{", i)) {
      const rows: string[] = [];
      let j = i + 4;
      while (j < text.length && text[j] === "{") {
        const [r, jj] = readGroup(text, j);
        rows.push(r);
        j = jj;
      }
      i = j;
      out.push(0x7f, 0x5d, 0xa4);
      for (const r of rows) {
        out.push(0xa4);
        const cells = r.split("&");
        for (let ci = 0; ci < cells.length; ci++) {
          if (ci) out.push(0x1c);
          out.push(...encodeRun(cells[ci], literalSuper));
        }
        out.push(0xb4);
      }
      out.push(0xb4);
      continue;
    }
    const ch = text[i];
    if (ch === "^") {
      let body: string;
      if (text[i + 1] === "{") {
        [body, i] = readGroup(text, i + 1);
      } else {
        body = text.slice(i + 1, i + 2);
        i = i + 2;
      }
      out.push(POWER);
      out.push(SUP_OPEN, ...encodeRun(body, literalSuper), SUP_CLOSE);
      continue;
    }
    if (ch === "_") {
      let body: string;
      if (text[i + 1] === "{") {
        [body, i] = readGroup(text, i + 1);
      } else {
        body = text.slice(i + 1, i + 2);
        i = i + 2;
      }
      emitSubscript(body, out);
      continue;
    }
    emitChar(ch, out, literalSuper);
    i += 1;
  }
  return out;
}

/** Encode Unicode text + EactMaker markup into CASIO bytes. */
export function encode(text: string, literalSuper = false): number[] {
  let t = text;
  for (const k of Object.keys(LATEX).sort((a, b) => b.length - a.length)) {
    t = t.split(k).join(LATEX[k]);
  }
  return encodeRun(t, literalSuper);
}

/** Encode one eActivity line. Returns [cellBytes, isNote]. A `\note{title}{body}`
 *  line becomes a note (type 0x06) sub-container; otherwise a normal line. */
export function encodeLine(
  line: string,
  literalSuper = false,
): [number[], boolean] {
  if (line.startsWith("\\note{")) {
    const [title, j] = readGroup(line, 5);
    const [body] = readGroup(line, j);
    return [
      buildNoteContent(encode(title, literalSuper), encode(body, literalSuper)),
      true,
    ];
  }
  return [encode(line, literalSuper), false];
}
