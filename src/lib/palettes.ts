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

// Greek alphabet in alphabetical order, each letter as lowercase then uppercase
// (α Α, β Β, … ω Ω). 0x03A2 is an unassigned codepoint, so it is skipped.
const GREEK = keepEncodable(
  range(0x0391, 0x03a9)
    .filter((c) => c.codePointAt(0) !== 0x03a2)
    .flatMap((upper) => [
      String.fromCodePoint(upper.codePointAt(0)! + 0x20),
      upper,
    ]),
);

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
  "∮",
  "∑",
  "∏",
  "Σ",
  "Π",
  "±",
  "×",
  "÷",
  "≤",
  "≥",
  "≠",
  "≈",
  "≡",
  "∝",
  "∈",
  "∉",
  "⊂",
  "⊆",
  "∪",
  "∩",
  "∅",
  "∀",
  "∃",
  "⇒",
  "⇔",
  "→",
  "↔",
  "°",
  "·",
  "∠",
  "⊥",
  "∥",
  "∴",
  "ℇ",
  "ℏ",
  "ℵ",
]);

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
]);

// The super/subscript palettes insert the literal CASIO superscript/subscript
// glyph characters (⁰…⁹ → E5C0–E5C9, ₀…₉ → E5D0–E5D9), exactly like the legacy
// EactMaker — these are standalone raised/lowered characters. For the *power*
// and *natural-display subscript* structures, use the `x▴` / `x▾` toolbar
// buttons, which insert `^{…}` / `_{…}` (and handle letters and multi-char).
const SUPERSCRIPTS = keepEncodable("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻".split(""));
const SUBSCRIPTS = keepEncodable("₀₁₂₃₄₅₆₇₈₉₊₋".split(""));

export type Palette = { id: string; label: string; items: string[] };

export const PALETTES: Palette[] = [
  { id: "maths", label: "Maths", items: MATHS },
  { id: "greek", label: "Greek", items: GREEK },
  { id: "superscripts", label: "Superscripts", items: SUPERSCRIPTS },
  { id: "subscripts", label: "Subscripts", items: SUBSCRIPTS },
  { id: "latin", label: "Latin", items: LATIN },
  { id: "cyrillic", label: "Cyrillic", items: CYRILLIC },
  { id: "misc", label: "Misc", items: MISC },
];
