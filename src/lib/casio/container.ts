// Port of fix_header(), _EACT_PREFIX, _FMT_OVERRIDES and build_eact() from
// casio_translate.py. Produces the .g1e/.g2e/.g3e byte container,
// byte-identical to EactMaker.
import type { EactFormat } from "./index";

function hex(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 2)
    out.push(parseInt(s.slice(i, i + 2), 16));
  return out;
}

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

const pad4 = (len: number) => (4 - (len % 4)) % 4;

// Fixed 0x00..0x67 header prefix produced by EactMaker (verified byte-identical
// across all examples). Size/checksum fields here are overwritten by fixHeader().
const PREFIX_LEN = 0x68; // bytes 0x00..0x67
const EACT_PREFIX = hex(
  "aaacbdaf90889a8db6ffefffefff0000" +
    "00000000000000000000000000000000" +
    "00000000000000380001020002020201" +
    "000000001000142a3f02c00000002830" +
    "00000000010201010103010101010101" +
    "01010101010100000000000000000000" +
    "0000000000000000",
);
if (EACT_PREFIX.length !== PREFIX_LEN)
  throw new Error(
    `EACT_PREFIX must be ${PREFIX_LEN} bytes, got ${EACT_PREFIX.length}`,
  );

// The format discriminator lives entirely in the prefix "subtype block": the
// bytes EactMaker varies per format all fall in [SUBTYPE_BLOCK_START, _END).
// Everything else in the container — checksums, offsets, cells — is identical
// across formats (verified byte-for-byte against the live server, size/content
// independent), and fixHeader() never touches this range.
const SUBTYPE_BLOCK_START = 0x28;
const SUBTYPE_BLOCK_END = 0x38; // exclusive

// Per-format overrides on EACT_PREFIX (mirror of Python _FMT_OVERRIDES). Each
// entry is {at, from, to}: `from` is the g2e baseline byte we expect at that
// offset and is asserted before we overwrite it — so any future edit that shifts
// the prefix layout trips a loud error here instead of silently emitting a wrong
// container. g1e stays the g2e baseline (this project's long-standing
// extension-only g1e; the live server's real g1e differs — see AGENTS.md).
interface PrefixOverride {
  at: number;
  from: number;
  to: number;
}
const FMT_OVERRIDES: Record<EactFormat, PrefixOverride[]> = {
  g2e: [],
  g1e: [],
  g3e: [
    { at: 0x2a, from: 0x02, to: 0x04 },
    { at: 0x2c, from: 0x02, to: 0x01 },
    { at: 0x2d, from: 0x02, to: 0x04 },
    { at: 0x2f, from: 0x01, to: 0x00 },
    { at: 0x34, from: 0x10, to: 0x2c },
  ],
};

/** Apply a format's subtype overrides to the assembled bytes, in place. */
function applyFormatOverrides(out: number[], format: EactFormat): void {
  for (const { at, from, to } of FMT_OVERRIDES[format]) {
    if (at < SUBTYPE_BLOCK_START || at >= SUBTYPE_BLOCK_END)
      throw new Error(
        `container: ${format} override 0x${at.toString(16)} is outside the subtype block`,
      );
    if (out[at] !== from)
      throw new Error(
        `container: prefix drift at 0x${at.toString(16)} — expected g2e baseline 0x${from.toString(16)}, got 0x${out[at].toString(16)}; ${format} overrides are stale`,
      );
    out[at] = to;
  }
}

/** Recompute the standard-header size + checksum fields. */
function fixHeader(b: number[]): number[] {
  const size = b.length;
  const sz = u32be(size);
  b[0x20] = sz[0];
  b[0x21] = sz[1];
  b[0x22] = sz[2];
  b[0x23] = sz[3]; // filesize
  const comp = u32be(~size >>> 0);
  b[0x10] = comp[0];
  b[0x11] = comp[1];
  b[0x12] = comp[2];
  b[0x13] = comp[3]; // ~filesize
  b[0x0e] = ~(size + 0x41) & 0xff; // control low byte
  b[0x0f] = 0xfe; // control high byte (constant)
  b[0x14] = (0x147 - size) & 0xff; // size-dependent header byte
  return b;
}

function ljust8(title: string): number[] {
  const t = title.slice(0, 8).padEnd(8, " ");
  return [...t].map((c) => c.charCodeAt(0) & 0xff);
}

/**
 * Build an eActivity (.g1e/.g2e/.g3e) the way EactMaker does.
 *   title       eActivity banner title (<=8 chars)
 *   linesBytes  one encoded byte-array per eActivity line
 *   noteFlags   per-line: true if the line is a \note (type 0x06 cell)
 *   format      container subtype (see FMT_OVERRIDES); defaults to "g2e"
 */
export function buildEactBytes(
  title: string,
  linesBytes: number[][],
  noteFlags?: boolean[],
  format: EactFormat = "g2e",
): Uint8Array {
  const BASE = 0x8c;
  const n = linesBytes.length + 1;
  const flags = noteFlags ?? linesBytes.map(() => false);

  const padCell = (content: number[], isNote: boolean): number[] => {
    const blob = [...content, 0x00];
    const npad = pad4(blob.length);
    for (let k = 0; k < npad; k++) blob.push(0x00);
    if (isNote) blob.push(0x00, 0x00, 0x00, 0x00);
    return blob;
  };

  const banner = [
    ...hex("3d3d3d3d3d3d"),
    ...ljust8(title),
    ...hex("3d3d3d3d3d3d3d"),
  ]; // ===… title …===
  const cells: Array<[number, number[]]> = [
    [0x07, banner],
    ...linesBytes.map((b, k): [number, number[]] => [
      flags[k] ? 0x06 : 0x81,
      b,
    ]),
  ];

  const contentStart = 0x90 + 4 * n + 4;
  const directory: number[] = [];
  const content: number[] = [];
  let pos = contentStart;
  for (const [typ, c] of cells) {
    const rel = pos - BASE;
    directory.push(typ, (rel >> 16) & 0xff, (rel >> 8) & 0xff, rel & 0xff);
    const blob = padCell(c, typ === 0x06);
    content.push(...blob);
    pos += blob.length;
  }

  const body: number[] = [];
  body.push(...hex("4045414354000000"), ...hex("00000001"), ...hex("00000000")); // @EACT
  body.push(...hex("4541435431000000"), ...hex("00000014"), ...hex("00000000")); // EACT1
  body.push(...hex("d4000066"), ...u32be(n));
  body.push(...directory);
  body.push(0x00, 0x00, 0x00, 0x00);
  body.push(...content);

  const out = [...EACT_PREFIX, ...body];
  applyFormatOverrides(out, format);
  const size = out.length;
  const a = u32be(size - 0x78);
  out[0x74] = a[0];
  out[0x75] = a[1];
  out[0x76] = a[2];
  out[0x77] = a[3]; // @EACT size
  const e = u32be(size - 0x8c);
  out[0x84] = e[0];
  out[0x85] = e[1];
  out[0x86] = e[2];
  out[0x87] = e[3]; // EACT1 size

  return new Uint8Array(fixHeader(out));
}
