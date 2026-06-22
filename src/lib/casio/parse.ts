// Inverse of buildEactBytes(): read a .g1e/.g2e/.g3e container back into an
// editable title + markup text. Cells are format-independent (only the prefix
// subtype block differs per format), so the reconstructed text is the same for
// every format; the detected format is reported for information only.
//
// Reconstruction is lossy as *text* but lossless as *bytes*: the returned
// content re-buildEact()s to the original cell bytes (proven over the whole
// corpus by scripts/parity-roundtrip.ts). See AGENTS.md for the byte contract.
import type { EactFormat } from "./index";
import { decodeMarkup } from "./decode";
import { parseNoteContent } from "./note";

const BASE = 0x8c; // directory offsets are relative to here (mirror container.ts)
const CELL_BANNER = 0x07;
const CELL_NOTE = 0x06;

function u32be(b: Uint8Array, off: number): number {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

// g3e is the only format with a distinguishing subtype block (mirror of
// FMT_OVERRIDES in container.ts). g1e == g2e bytes, so they're indistinguishable.
function detectFormat(b: Uint8Array): EactFormat {
  if (
    b[0x2a] === 0x04 &&
    b[0x2c] === 0x01 &&
    b[0x2d] === 0x04 &&
    b[0x2f] === 0x00 &&
    b[0x34] === 0x2c
  )
    return "g3e";
  return "g2e";
}

// Banner cell: "======" + title.padEnd(8) + "=======". Title is bytes 6..14.
function decodeBanner(cell: number[]): string {
  return cell
    .slice(6, 14)
    .map((c) => String.fromCharCode(c))
    .join("")
    .replace(/\s+$/, "");
}

export interface ParsedEact {
  title: string;
  content: string;
  format: EactFormat;
  /** true if any cell contained bytes with no markup form (emitted as \xHH). */
  lossy: boolean;
}

/** Parse a .g1e/.g2e/.g3e container into an editable title + markup body. */
export function parseEact(bytes: Uint8Array): ParsedEact {
  if (bytes.length < 0x94)
    throw new Error("not an eActivity file (too short)");
  // d4 00 00 66 directory marker sits just before the cell count at 0x8c.
  if (
    !(
      bytes[0x88] === 0xd4 &&
      bytes[0x89] === 0x00 &&
      bytes[0x8a] === 0x00 &&
      bytes[0x8b] === 0x66
    )
  )
    throw new Error("not a recognised eActivity container");

  const format = detectFormat(bytes);
  const n = u32be(bytes, BASE);
  if (n < 1 || 0x90 + 4 * n + 4 > bytes.length)
    throw new Error("eActivity directory is malformed");

  const offsets: number[] = [];
  const types: number[] = [];
  for (let k = 0; k < n; k++) {
    const p = 0x90 + 4 * k;
    types.push(bytes[p]);
    offsets.push(BASE + ((bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]));
  }

  let title = "";
  const lines: string[] = [];
  let lossy = false;

  for (let k = 0; k < n; k++) {
    const start = offsets[k];
    const end = k + 1 < n ? offsets[k + 1] : bytes.length;
    if (start > end || end > bytes.length)
      throw new Error("eActivity cell offsets are out of range");
    const cell = Array.from(bytes.slice(start, end));

    if (types[k] === CELL_BANNER) {
      title = decodeBanner(cell);
    } else if (types[k] === CELL_NOTE) {
      const { titleBytes, bodyBytes } = parseNoteContent(cell);
      const t = decodeMarkup(titleBytes);
      const body = decodeMarkup(bodyBytes);
      lossy = lossy || t.lossy || body.lossy;
      lines.push(`\\note{${t.text}}{${body.text}}`);
    } else {
      // 0x81 normal line (treat anything else as a line too).
      const m = decodeMarkup(cell);
      lossy = lossy || m.lossy;
      lines.push(m.text);
    }
  }

  return { title, content: lines.join("\n"), format, lossy };
}
