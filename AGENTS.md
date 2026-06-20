<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Eact Maker (web)

Browser-based CASIO **eActivity** generator. Next.js 16 (App Router, TypeScript strict, Tailwind v4).
A modern re-creation of [EactMaker](https://tools.planet-casio.com/EactMaker/); see
[`README.md`](README.md) for user-facing docs. Everything runs **client-side — there is no backend.**

## The encoder is a port — keep it byte-identical

`src/lib/casio/` is a faithful TypeScript port of `../casio-eactgen-py/casio_translate.py`. That
Python file (and its `AGENTS.md`) is the **source of truth** for the reverse-engineered `.g2e`/`.g1e`
binary format: standard header + checksums, the MCS directory, cell layout, and every markup→bytes
mapping. Read it before changing encoder behaviour.

| File | Mirrors (Python) |
|------|------------------|
| `src/lib/casio/encode.ts` | `_encode_run`, `encode`, `_emit_char`, `_emit_subscript`, `encode_line`, markup parsers, `LATEX`/`SUPERS`/`VULGAR`/`EACT_OVERRIDE` |
| `src/lib/casio/note.ts` | `build_note_content` + `_NOTE_*` templates |
| `src/lib/casio/container.ts` | `fix_header`, `_EACT_PREFIX`, `build_eact` |
| `src/lib/casio/decode.ts` | `decode` (used by the preview) |
| `src/lib/casio/chars.ts` | loads the generated maps |
| `src/lib/casio/index.ts` | public API: `buildEact`, `encode`, `encodeLine`, `decode`, `splitlines` |

**Any change to the encoder must keep `npm run test:parity` green.** That test
(`scripts/parity.ts`) byte-compares this TS output against live Python output over the whole of
`../casio-eactgen-py/input.txt` (every line in both superscript modes, plus the full container incl.
notes across several titles). It is the contract: byte-for-byte equality with the Python reference,
which is itself verified byte-identical to real EactMaker output.

## Character table

`src/lib/casio/chars.generated.json` (the Unicode↔CASIO `enc`/`dec` maps) is **generated**, not
hand-edited. `scripts/gen-chars.mjs` (`npm run gen:chars`) ports the Python `load_table` +
`build_maps` and reads `../casio-eactgen-py/chars.toml` (Cahute project, CeCILL 2.1). Regenerate it
if `chars.toml` changes; the JSON is committed so the app has no `.toml` dependency at runtime.

## UI

`src/components/EactMaker.tsx` holds all editor state and is rendered **client-only** via
`EactMakerClient.tsx` (`next/dynamic` with `ssr: false`). This is deliberate: it lets the component
read `localStorage` in lazy `useState` initializers without a hydration mismatch, and satisfies the
`react-hooks/set-state-in-effect` lint rule (no state restore inside an effect). Keep it that way —
don't move `localStorage` reads into effects or render EactMaker on the server.

- Palettes (`src/lib/palettes.ts`) filter every glyph through `encode()` at module load, so a
  palette button can never produce a character the encoder rejects.
- Snippet insertion (`src/lib/insertAtCaret.ts`) is pure; the component restores the caret via a
  `pendingCaret` ref in a post-render effect.

## Gotchas learned here

- **Pad-loop bug:** `for (let k = 0; k < pad4(arr.length); k++) arr.push(0)` re-evaluates the
  *growing* length each iteration and under-pads. Compute the count once before the loop. (This was
  the one bug that broke byte-parity during the port.)
- The Python `_emit_char` calls an **undefined** `_emit_fraction` (vulgar fractions ½⅓ would crash);
  the TS port implements it correctly (`emitFraction`). Don't "fix" it back to match Python here.
- Some Unicode chars are genuinely absent from the CASIO table (e.g. `∞`, `α`); both implementations
  correctly throw. The preview surfaces the error — that's expected, not a bug.
- Only **G1E / G2E** are supported (byte-identical; extension only). G3E/FLS/XCP/CAT are unimplemented
  upstream and intentionally omitted from the Format dropdown.

## Commands

```bash
npm run dev          # dev server
npm run gen:chars    # regenerate chars.generated.json
npm run test:parity  # byte-parity vs the Python reference (run after touching the encoder)
npm run build        # production build
npm run lint         # eslint
```
