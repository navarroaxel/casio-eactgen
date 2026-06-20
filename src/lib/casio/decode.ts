// Port of decode() from casio_translate.py (362-393).
// CASIO bytes -> readable Unicode (for the live preview pane).
import { dec } from "./chars";
import { LEAD_BYTES, NABLA_CODE, POWER, SUP_OPEN, SUP_CLOSE } from "./encode";

export function decode(data: ArrayLike<number>, raw = false): string {
  const out: string[] = [];
  let i = 0;
  const n = data.length;
  while (i < n) {
    const b = data[i];
    let code: number;
    if (LEAD_BYTES.has(b) && i + 1 < n) {
      code = (b << 8) | data[i + 1];
      i += 2;
    } else {
      code = b;
      i += 1;
    }
    if (!raw && code === POWER) {
      out.push("^");
      continue;
    }
    if (!raw && code === SUP_OPEN) {
      out.push("(");
      continue;
    }
    if (!raw && code === SUP_CLOSE) {
      out.push(")");
      continue;
    }
    if (!raw && code === NABLA_CODE && !dec.has(code)) {
      out.push("∇");
      continue;
    }
    const s = dec.get(code);
    if (s !== undefined) out.push(s);
    else if (code >= 0x20 && code <= 0x7e) out.push(String.fromCharCode(code));
    else if (code === 0x00) out.push(raw ? "␀" : "");
    else
      out.push("\\x" + code.toString(16).padStart(code <= 0xff ? 2 : 4, "0"));
  }
  return out.join("");
}
