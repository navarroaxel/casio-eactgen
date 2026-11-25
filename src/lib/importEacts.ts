import { parseEact, type EactFormat } from "@/lib/casio";
import { newFile, type EactFile } from "@/lib/project";

export interface ImportResult {
  files: EactFile[];
  /** One-line summary for the status bar. */
  message: string;
}

/**
 * Import compiled .g1e/.g2e/.g3e eActivities back into editable markup. Each
 * file becomes a new project file; the on-calc banner is its name (falling back
 * to the filename). Reconstruction is byte-lossless but text-lossy.
 */
export async function importEactFiles(list: File[]): Promise<ImportResult> {
  const files: EactFile[] = [];
  const errors: string[] = [];
  const formats = new Set<EactFormat>();
  let lossy = 0;
  for (const f of list) {
    try {
      const parsed = parseEact(new Uint8Array(await f.arrayBuffer()));
      const stem = f.name.replace(/\.[^.]*$/, "");
      files.push(
        newFile({
          title: parsed.title || stem.slice(0, 8),
          content: parsed.content,
        }),
      );
      formats.add(parsed.format);
      if (parsed.lossy) lossy += 1;
    } catch {
      errors.push(f.name);
    }
  }
  const parts: string[] = [];
  if (files.length > 0)
    parts.push(`Imported ${files.length} file(s) (${[...formats].join(", ")})`);
  if (lossy > 0) parts.push(`${lossy} had undecodable bytes (\\xHH)`);
  if (errors.length > 0) parts.push(`couldn't read ${errors.join(", ")}`);
  return { files, message: parts.join(" · ") || "No eActivity files imported" };
}
