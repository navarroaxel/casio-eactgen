import { buildEact, type EactFormat } from "@/lib/casio";

export interface CompileOptions {
  format: EactFormat;
  /** Project "compatibility mode": encode ² ³ as literal glyphs. */
  compatibility: boolean;
}

/** Compile one project file to its .g*e bytes (throws on an unencodable char). */
export function compileFile(
  file: { title: string; content: string },
  { format, compatibility }: CompileOptions,
): Uint8Array {
  return buildEact(file.title, file.content, {
    literalSuper: compatibility,
    format,
  });
}
