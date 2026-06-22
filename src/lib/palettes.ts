// Character palettes for the editor. Every glyph is verified encodable against
// the CASIO table at module load, so no palette button can produce a char the
// encoder rejects.
import { encode } from "./casio/encode";

function canEncode(ch: string): boolean {
  try {
    encode(ch);
    return true;
  } catch {
    return false;
  }
}

function range(from: number, to: number): string[] {
  const out: string[] = [];
  for (let cp = from; cp <= to; cp++) out.push(String.fromCodePoint(cp));
  return out;
}

const keepEncodable = (chars: string[]) => chars.filter(canEncode);

// Greek alphabet: all uppercase first (Α … Ω), then all lowercase (α … ω).
// 0x03A2 is an unassigned codepoint, so it is skipped.
const GREEK = keepEncodable([
  ...range(0x0391, 0x03a9).filter((c) => c.codePointAt(0) !== 0x03a2), // Α … Ω
  ...range(0x03b1, 0x03c9), // α … ω
]);

const CYRILLIC = keepEncodable([
  ...range(0x0410, 0x044f), // А … я
]);

const LATIN = keepEncodable([
  ...range(0x00c0, 0x00ff), // À … ÿ accented latin
]);

const MATHS = keepEncodable([
  "∇",
  "∂",
  "∞",
  "√",
  "∫",
  "∬",
  "∮",
  "∑",
  "∏",
  "Σ",
  "Π",
  "+",
  "±",
  "×",
  "÷",
  "·",
  "≤",
  "≥",
  "≠",
  "≈",
  "≅",
  "≒",
  "≡",
  "≢",
  "∝",
  "~",
  "∈",
  "∉",
  "∋",
  "∌",
  "⊂",
  "⊃",
  "⊆",
  "⊇",
  "⊄",
  "⊅",
  "⊈",
  "⊉",
  "∪",
  "⋃",
  "∩",
  "⋂",
  "∅",
  "∀",
  "∃",
  "∧",
  "∨",
  "⊕",
  "⊖",
  "⊗",
  "⊘",
  "⇒",
  "⇔",
  "→",
  "↔",
  "°",
  "′",
  "″",
  "∠",
  "∡",
  "∟",
  "⊥",
  "⟂",
  "∥",
  "∦",
  "|",
  "⫽",
  "∴",
  "∵",
  "ℏ",
  "ℵ",
  "ⅈ",
]);

const MATHS_NAMES: Record<string, string> = {
  "∇": "del (nabla)",
  "∂": "partial derivative",
  "∞": "infinity",
  "√": "square root",
  "∫": "integral",
  "∬": "double integral",
  "∮": "contour integral",
  "∑": "n-ary summation",
  "∏": "n-ary product",
  Σ: "sigma (uppercase)",
  Π: "pi (uppercase)",
  "+": "addition",
  "±": "plus-minus",
  "×": "multiplication",
  "÷": "division",
  "·": "middle dot",
  "≤": "less than or equal to",
  "≥": "greater than or equal to",
  "≠": "not equal to",
  "≈": "approximately equal to",
  "≅": "approximately equal to (congruent)",
  "≒": "approximately equal to or the image of",
  "≡": "identical to",
  "≢": "not identical to",
  "∝": "proportional to",
  "~": "tilde (equivalent to)",
  "∈": "element of",
  "∉": "not an element of",
  "∋": "contains as member",
  "∌": "does not contain as member",
  "⊂": "subset of",
  "⊃": "superset of",
  "⊆": "subset of or equal to",
  "⊇": "superset of or equal to",
  "⊄": "not a subset of",
  "⊅": "not a superset of",
  "⊈": "neither a subset of nor equal to",
  "⊉": "neither a superset of nor equal to",
  "∪": "union",
  "⋃": "n-ary union",
  "∩": "intersection",
  "⋂": "n-ary intersection",
  "∅": "empty set",
  "∀": "for all",
  "∃": "there exists",
  "∧": "logical and",
  "∨": "logical or",
  "⊕": "circled plus",
  "⊖": "circled minus",
  "⊗": "circled times",
  "⊘": "circled division slash",
  "⇒": "implies",
  "⇔": "if and only if",
  "→": "rightwards arrow",
  "↔": "left-right arrow",
  "°": "degree",
  "′": "prime",
  "″": "double prime",
  "∠": "angle",
  "∡": "measured angle",
  "∟": "right angle",
  "⊥": "perpendicular",
  "⟂": "perpendicular (orthogonal)",
  "∥": "parallel to",
  "∦": "not parallel to",
  "|": "vertical bar",
  "⫽": "double slash",
  "∴": "therefore",
  "∵": "because",
  ℏ: "reduced Planck constant",
  ℵ: "aleph",
  ⅈ: "imaginary unit",
};

const mathsTitle = (ch: string): string => MATHS_NAMES[ch] ?? ch;

// CASIO statistical / small-script glyphs whose inserted text differs from the
// button glyph: combining-mark sequences (x̄, ŷ …), the dedicated ⁻¹ glyph, and
// `\token;` markup for the small subscripts / special ³ that have no Unicode at
// all. The encoder (RAW_SEQ in casio/encode.ts) maps each to its FONTCHARACTER.
const MATHS_EXTRA: PaletteItem[] = [
  { insert: "\\s10;", label: "10", title: "small 10 (×10 exponent)" },
  { insert: "\\sE;", label: "ᴇ", title: "scientific E (×10ⁿ)" },
  { insert: "x̅", label: "x̅", title: "x̄ — mean of x" },
  { insert: "y̅", label: "y̅", title: "ȳ — mean of y" },
  { insert: "x̂", label: "x̂", title: "x̂ — estimated x" },
  { insert: "ŷ", label: "ŷ", title: "ŷ — estimated y" },
  { insert: "p̂", label: "p̂", title: "p̂ — estimated sample proportion" },
  { insert: "⁻¹", label: "⁻¹", title: "superscript −1" },
  { insert: "\\subs0;", label: "₀", title: "small subscript 0" },
  { insert: "\\subs1;", label: "₁", title: "small subscript 1" },
  { insert: "\\subs2;", label: "₂", title: "small subscript 2" },
  { insert: "ₙ", label: "ₙ", title: "small subscript n" },
  { insert: "\\supr3;", label: "³", title: "special superscript 3" },
];

const MISC = keepEncodable([
  "←",
  "↑",
  "↓",
  "↕",
  "↗",
  "↘",
  "◯",
  "□",
  "■",
  "△",
  "▽",
  "◇",
  "★",
  "☆",
  "♥",
  "♦",
  "♣",
  "♠",
  "§",
  "¶",
  "†",
  "‡",
  "•",
  "‰",
  "€",
  "£",
  "¥",
  "¢",
  "©",
  "®",
  "™",
  "µ",
  "¿",
  "¡",
  "«",
  "»",
  "【",
  "】",
  // arrows / triangles / shapes from the original Misc tab
  "→",
  "↖",
  "↙",
  "◀",
  "▶",
  "▲",
  "▹",
  "○",
  "●",
  "▫",
  "◢",
  "⌟",
  // typographic / currency / signs
  "ƒ",
  "…",
  "‘",
  "’",
  "“",
  "”",
  "¬",
  "¤",
  "·",
  // ASCII punctuation (the original Misc tab includes these)
  "/",
  "\\",
  "^",
  "`",
  "{",
  "|",
  "}",
  "~",
  "*",
  "‐",
]);

// Misc tab CASIO-only glyphs (negative-video letters/signs, GRAPH bold letters,
// wide comma, serif r) — inserted as `\token;` markup that the encoder
// (RAW_SEQ in casio/encode.ts) maps to the right FONTCHARACTER. Labels are the
// nearest glyph for the button; the inserted text is the token.
const MISC_EXTRA: PaletteItem[] = [
  { insert: "ℇ", label: "ℇ", title: "Euler constant" },
  { insert: "\\nvB;", label: "🅱", title: "negative-video B" },
  { insert: "\\nvR;", label: "🆁", title: "negative-video R" },
  { insert: "\\nvL;", label: "🅻", title: "negative-video L" },
  { insert: "\\nvEq;", label: "⌸", title: "negative-video =" },
  { insert: "\\nvLt;", label: "⍃", title: "negative-video <" },
  { insert: "\\nvGt;", label: "⍄", title: "negative-video >" },
  { insert: "\\nvLE;", label: "≤", title: "negative-video ≤" },
  { insert: "\\nvGE;", label: "≥", title: "negative-video ≥" },
  { insert: "\\boldP;", label: "𝐏", title: "bold P (probability)" },
  { insert: "\\boldr;", label: "𝐫", title: "bold r (regression)" },
  { insert: "\\boldX;", label: "𝐗", title: "bold X (graph)" },
  { insert: "\\boldY;", label: "𝐘", title: "bold Y (graph)" },
  { insert: "\\serifr;", label: "𝚛", title: "serif r" },
  { insert: "\\lgComma;", label: ",", title: "wide comma" },
];

export interface PaletteItem {
  /** Text inserted into the editor when the button is clicked. */
  insert: string;
  /** Glyph shown on the button. */
  label: string;
  /** Hover tooltip. */
  title: string;
}

export type Palette = { id: string; label: string; items: PaletteItem[] };

// Greek letter Latin names, used for the button tooltips (e.g. ω → "omega",
// Ω → "Omega"). Keyed by the lowercase letter.
const GREEK_NAMES: Record<string, string> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  ο: "omicron",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  ς: "final sigma",
  τ: "tau",
  υ: "upsilon",
  φ: "phi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
};

function greekTitle(ch: string): string {
  const lower = ch.toLowerCase();
  const name = GREEK_NAMES[lower];
  if (!name) return ch;
  const isUpper = ch !== lower && ch === ch.toUpperCase();
  return isUpper ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

const charItems = (
  chars: string[],
  title: (c: string) => string = (c) => c,
): PaletteItem[] =>
  chars.map((c) => ({ insert: c, label: c, title: title(c) }));

// Unicode superscript/subscript glyphs, used as button labels. Digits and signs
// also exist as standalone CASIO glyphs (inserted literally, like the legacy
// EactMaker); letters do not, so those are inserted as `^x` / `_x` markup
// (the power / natural-display subscript structure).
const SUP_GLYPH: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
};
const SUB_GLYPH: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

const DIGITS_SIGNS = "0123456789+-".split("");
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

function scriptItems(kind: "sup" | "sub"): PaletteItem[] {
  const glyphs = kind === "sup" ? SUP_GLYPH : SUB_GLYPH;
  const prefix = kind === "sup" ? "^" : "_";
  const word = kind === "sup" ? "superscript" : "subscript";
  const items: PaletteItem[] = [];
  // Digits and signs: insert the literal CASIO glyph (matches legacy output).
  for (const d of DIGITS_SIGNS) {
    const glyph = glyphs[d];
    if (glyph && canEncode(glyph)) {
      items.push({ insert: glyph, label: glyph, title: `${word} ${d}` });
    }
  }
  // Letters: no standalone glyph in the font, so use `^x` / `_x` markup. The
  // tiny super/subscript letter glyphs are hard to read, so label the button
  // with the plain letter (the tooltip shows what it inserts).
  for (const l of LETTERS) {
    const ins = `${prefix}${l}`;
    if (canEncode(ins)) {
      items.push({ insert: ins, label: l, title: `${word} ${l}  (${ins})` });
    }
  }
  return items;
}

export const PALETTES: Palette[] = [
  {
    id: "maths",
    label: "Maths",
    items: [...charItems(MATHS, mathsTitle), ...MATHS_EXTRA],
  },
  { id: "greek", label: "Greek", items: charItems(GREEK, greekTitle) },
  { id: "superscripts", label: "Superscripts", items: scriptItems("sup") },
  { id: "subscripts", label: "Subscripts", items: scriptItems("sub") },
  { id: "latin", label: "Latin", items: charItems(LATIN) },
  { id: "cyrillic", label: "Cyrillic", items: charItems(CYRILLIC) },
  {
    id: "misc",
    label: "Misc",
    items: [...charItems(MISC), ...MISC_EXTRA],
  },
];
