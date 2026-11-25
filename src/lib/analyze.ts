import { decode, encodeLine, splitlines } from "@/lib/casio";
import { compileFile, type CompileOptions } from "@/lib/compile";
import { errorMessage } from "@/lib/errorMessage";

export interface PreviewLine {
  text: string;
  note: boolean;
}

export interface Analysis {
  /** Compiled size in bytes, or null if encoding failed. */
  size: number | null;
  lineCount: number;
  preview: PreviewLine[];
  error: string | null;
}

/** Live encode: byte size + per-line decoded preview + first error. */
export function analyze(
  title: string,
  content: string,
  opts: CompileOptions,
): Analysis {
  const lines = splitlines(content);
  const preview: PreviewLine[] = [];
  try {
    for (const ln of lines) {
      const [bytes] = encodeLine(ln, opts.compatibility); // throws if invalid
      if (ln.startsWith("\\note{")) {
        preview.push({ text: ln, note: true });
      } else {
        preview.push({ text: decode(bytes) || " ", note: false });
      }
    }
    const bytes = compileFile({ title, content }, opts);
    return {
      size: bytes.length,
      lineCount: lines.length,
      preview,
      error: null,
    };
  } catch (err) {
    return {
      size: null,
      lineCount: lines.length,
      preview,
      error: errorMessage(err),
    };
  }
}
