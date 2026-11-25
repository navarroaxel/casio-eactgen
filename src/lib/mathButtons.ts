import type { Snippet } from "@/lib/insertAtCaret";

export interface MathButton extends Snippet {
  label: string;
  title: string;
  /** force the snippet onto its own line (used by \note). */
  ownLine?: boolean;
}

export const MATH_BUTTONS: MathButton[] = [
  { label: "√▢", title: "Square root — √a", pre: "\\sqrt{", post: "}" },
  { label: "a⁄b", title: "Fraction — a over b", pre: "\\frac{", post: "}{}" },
  { label: "x▾", title: "Subscript — xₐ", pre: "_{", post: "}" },
  { label: "x▴", title: "Superscript / power — xᵃ", pre: "^{", post: "}" },
  {
    label: "Σ",
    title: "Summation — Σ of the first n (variable k, from 0)",
    pre: "\\sum{",
    post: "}{k}{0}{}",
  },
  { label: "[▦]", title: "Matrix 2×3", pre: "\\mat{", post: "&&}{&&}" },
  {
    label: "logₐ",
    title: "Logarithm — log base a of b",
    pre: "\\log{",
    post: "}{}",
  },
  {
    label: "|a|",
    title: "Absolute value / modulus of a",
    pre: "\\abs{",
    post: "}",
  },
  {
    label: "d⁄dx",
    title: "Derivative of a w.r.t. x",
    pre: "\\diff{",
    post: "}{x}",
  },
  {
    label: "d²⁄dx²",
    title: "Second derivative of a w.r.t. x",
    pre: "\\diff2{",
    post: "}{x}",
  },
  {
    label: "∫",
    title: "Integral — from a to b of c",
    pre: "\\int{",
    post: "}{}{}",
  },
  {
    label: "🗒 Note",
    title: "Note strip — \\note{title}{body} (own line)",
    pre: "\\note{",
    post: "}{}",
    ownLine: true,
  },
];
