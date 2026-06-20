// Port of build_note_content() + note templates from casio_translate.py (151-180).
// A \note is a nested @RUNMAT/TEXT1 sub-container (type 0x06 cell).

function hex(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 2)
    out.push(parseInt(s.slice(i, i + 2), 16));
  return out;
}

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

const pad4 = (n: number) => (4 - (n % 4)) % 4;

// "@EACT" + 8 zero bytes + 0a 00 00  (16 bytes)
const NOTE_PREFIX16 = [
  0x40, 0x45, 0x41, 0x43, 0x54, 0, 0, 0, 0, 0, 0, 0, 0, 0x0a, 0x00, 0x00,
];

// mark+8 .. @RUNMAT (68 bytes, constant)
const NOTE_NESTED_HEADER = hex(
  "0000003800010200020002000000000000001c2a" +
    "3f02c00000002830000000000101020101010301010101010101010101010100" +
    "00000000000000000000000000000000",
);

const NOTE_RUNMAT = [...hex("4052554e4d415400"), ...hex("00000001")]; // "@RUNMAT\0" + 00000001
const NOTE_TEXT1 = [...hex("5445585431000000"), ...hex("00000014")]; // "TEXT1\0\0\0" + 00000014
const NOTE_ITEM = hex("d4000003" + "00000001" + "8100000c" + "00000000");

/** Build the content of a \note cell (type 0x06). build_eact() pads it. */
export function buildNoteContent(
  titleBytes: number[],
  bodyBytes: number[],
): number[] {
  const tr: number[] = [...titleBytes, 0x00];
  const npad = pad4(tr.length);
  for (let k = 0; k < npad; k++) tr.push(0x00);

  const bodyCellLen = bodyBytes.length + 1 + pad4(bodyBytes.length + 1);
  const rm = 0x20 + bodyCellLen;
  const tx = rm - 0x14;

  const content: number[] = [
    ...NOTE_PREFIX16,
    ...tr,
    0xab,
    0xcd,
    0xef,
    0x89,
    0x00,
    0x00,
    0x00,
    0x00,
    ...NOTE_NESTED_HEADER,
    ...NOTE_RUNMAT,
    ...u32be(rm),
    ...NOTE_TEXT1,
    ...u32be(tx),
    ...NOTE_ITEM,
    ...bodyBytes,
  ];

  let plen = content.length + 1;
  plen += pad4(plen) + 4; // build_eact's note pad rule
  const mark = 16 + tr.length;
  const outsz = plen - (mark + 8);

  // overwrite the 4 zero bytes at mark+4 with outsz (big-endian)
  return [
    ...content.slice(0, mark + 4),
    ...u32be(outsz),
    ...content.slice(mark + 8),
  ];
}
