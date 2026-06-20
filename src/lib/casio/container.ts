// Port of fix_header(), _EACT_PREFIX and build_eact() from
// casio_translate.py (395-483). Produces the .g1e/.g2e byte container,
// byte-identical to EactMaker.

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
const EACT_PREFIX = hex(
  "aaacbdaf90889a8db6ffefffefff0000" +
    "00000000000000000000000000000000" +
    "00000000000000380001020002020201" +
    "000000001000142a3f02c00000002830" +
    "00000000010201010103010101010101" +
    "01010101010100000000000000000000" +
    "0000000000000000",
);

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
 * Build an eActivity (.g1e/.g2e) the way EactMaker does.
 *   title       eActivity banner title (<=8 chars)
 *   linesBytes  one encoded byte-array per eActivity line
 *   noteFlags   per-line: true if the line is a \note (type 0x06 cell)
 */
export function buildEactBytes(
  title: string,
  linesBytes: number[][],
  noteFlags?: boolean[],
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
