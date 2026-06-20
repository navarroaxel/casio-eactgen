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

const GREEK = keepEncodable([
  ...range(0x03b1, 0x03c9), // α … ω
  ...range(0x0391, 0x03a9), // Α … Ω
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

export type Palette =
  | { id: string; label: string; kind: "char"; items: string[] }
  | { id: string; label: string; kind: "subscript"; items: string[] };

// Subscripts are produced via the `_` markup (e.g. clicking "₂" inserts "_2").
const SUBSCRIPTS = "0123456789+-abcdefghijklmnopqrstuvwxyz".split("");

export const PALETTES: Palette[] = [
  { id: "maths", label: "Maths", kind: "char", items: MATHS },
  { id: "greek", label: "Greek", kind: "char", items: GREEK },
  {
    id: "subscripts",
    label: "Subscripts",
    kind: "subscript",
    items: SUBSCRIPTS,
  },
  { id: "latin", label: "Latin", kind: "char", items: LATIN },
  { id: "cyrillic", label: "Cyrillic", kind: "char", items: CYRILLIC },
  { id: "misc", label: "Misc", kind: "char", items: MISC },
];

// Map a subscript base char to its visible glyph for the button label.
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
};
export function subscriptLabel(ch: string): string {
  return SUB_GLYPH[ch] ?? `₍${ch}₎`;
}
