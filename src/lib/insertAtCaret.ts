// Caret-aware snippet insertion for the editor textarea.

export interface Snippet {
  /** Text inserted before the (optional) selection. */
  pre: string;
  /** Text inserted after the selection. Defaults to "". */
  post?: string;
}

export interface InsertResult {
  value: string;
  /** Where to place the caret afterwards (right after the first argument). */
  caret: number;
}

/**
 * Insert `snip` at the current selection. Any selected text is kept and placed
 * between `pre` and `post` (so e.g. selecting "x" then clicking √ gives √{x}).
 * The caret lands right after that first argument, ready for typing.
 */
export function applySnippet(
  value: string,
  selStart: number,
  selEnd: number,
  snip: Snippet,
): InsertResult {
  const sel = value.slice(selStart, selEnd);
  const post = snip.post ?? "";
  const newValue =
    value.slice(0, selStart) + snip.pre + sel + post + value.slice(selEnd);
  const caret = selStart + snip.pre.length + sel.length;
  return { value: newValue, caret };
}
