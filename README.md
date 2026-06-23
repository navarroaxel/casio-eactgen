# Eact Maker — CASIO eActivity generator (web)

*[Versión en español](README.es.md)*

A browser-based tool to build CASIO **eActivity** files (`.g2e` / `.g1e` / `.g3e`) for fx-9860G–series
and fx-CG (Prizm) graphing calculators. Write your formulas with a small LaTeX-like markup, preview the result, and
download a file you can transfer to the calculator — all **client-side**, no server, nothing leaves
your machine.

It's a modern re-creation of the online
[EactMaker](https://tools.planet-casio.com/EactMaker/) tool by Helder7 and Ziqumu. The encoder is a
direct port of the reverse-engineered [`casio-eactgen-py`](https://github.com/navarroaxel/casio-eactgen-py) generator, and its
output is **byte-identical** to both the Python reference and real EactMaker output (verified by
`npm test`).

> **Extensions.** The fx-9860G**III** opens **both `.g1e` and `.g2e`** — the two containers are
> byte-structurally identical; only the extension differs (`.g2e` is the native format for the
> GII/GIII, `.g1e` is the older fx-9860G format). `.g2e` is the safe default. `.g3e` targets the
> color **fx-CG (Prizm)** line; it shares the same container as `.g2e` apart from a fixed subtype
> block (matched byte-for-byte to EactMaker). If a file won't open, the cause is the *contents*,
> not the extension.

## Features

- **Live editor** — one eActivity line per row, with a math toolbar (√, fraction, sub/superscript,
  Σ, matrix, log, |a|, derivatives, integral, note) and character palettes (Maths, Greek,
  Subscripts, Latin, Cyrillic, Misc).
- **Live preview & validation** — decodes your input back to readable text, shows the output size,
  and flags any character the CASIO font table can't represent *before* you convert.
- **Convert & download** — generates the `.g2e`/`.g1e` file in the browser.
- **Import existing eActivities** — "Import .g*e…" reads `.g1e`/`.g2e`/`.g3e` files made by another
  program or on the calculator itself back into editable markup, one project file each. Works in
  every browser. The markup is rebuilt faithfully (it re-compiles to the same bytes) though some
  forms are normalised — e.g. `²` may come back as `^{2}` and `½` as `\frac{1}{2}`.
- **Save / Load project** — store your work as a `.eam.json` file; the editor also autosaves to
  `localStorage` and restores on reload.
- **Save to file & auto-save** — in Chromium browsers (Chrome/Edge), link the project to a
  `.eam.json` on disk and it auto-saves there as you work. **Tip:** save into a Google Drive /
  Dropbox / OneDrive *synced* folder to keep your project in the cloud and across devices — no
  account, login, or backend required. Firefox/Safari fall back to manual Save / Load download.
- **Sync to folder** — also in Chromium, map the project to a folder on disk: the compiled
  `.g2e`/`.g1e` files (with project subfolders recreated) are written there and re-synced as you
  edit, so a Drive-synced folder always holds calculator-ready files. Moving, renaming, or deleting
  a file removes its stale output (and any folder it empties) — only files this app wrote are ever
  deleted, so other files in the folder are left untouched.

## Getting started

```bash
npm install
npm run gen:chars      # build the character table JSON from chars.toml
npm run dev            # http://localhost:3000
```

`npm run gen:chars` only needs to be run once (the generated JSON is committed); re-run it if
`chars.toml` changes. It reads `chars.toml` from a local clone of
[`casio-eactgen-py`](https://github.com/navarroaxel/casio-eactgen-py) — by default `../casio-eactgen-py`
(next to this repo); override with `CHARS_TOML=<path> npm run gen:chars`.

## How to use

1. Enter a **Title** (≤8 chars — it becomes the `======TITLE======` banner and the on-calculator name).
2. Type your formulas in the editor, one eActivity line per row. Use the toolbar/palette buttons or
   type the markup directly.
3. Pick a **Format** (`.g2e` default, `.g1e`, or `.g3e` for fx-CG / Prizm).
4. Click **Convert & download**, then copy the file to the calculator (USB mass storage / Link /
   FA-124) and open it from the eActivity menu.

**Compatibility mode** toggles how `²` `³` are encoded: off → the literal superscript glyph;
on → the power form (`^`). It maps to the encoder's `literalSuper` option.

## Markup

| You write | Result |
|-----------|--------|
| `\frac{a}{b}` | stacked fraction |
| `½ ⅓ ¼ …` | stacked fraction (vulgar-fraction glyphs) |
| `\sqrt{x}` | square root |
| `\abs{x}` | absolute value / modulus |
| `\int{lo}{hi}{f}` | integral (any arg may be empty: `\int{}{x=V}{f}`) |
| `\log{a}{b}` | log base *a* of *b* |
| `\sum{n}{k}{0}{a}` | sum (count, variable, start, expression) |
| `\mat{a&b}{c&d}` | matrix (rows in `{}`, cells split by `&`) |
| `\diff{a}{b}` / `\diff2{a}{b}` | 1st / 2nd derivative of *a* in *b* |
| `\note{title}{body}` | note / memo strip (own line) |
| `^2`, `^{n+1}` | superscript / power |
| `_v`, `_{12}` | subscript (letters and digits) |
| `²` `³` | superscript glyphs |
| `∇ ∂ · ⇒ ε μ π σ ρ θ Ω …` | typed directly as Unicode |
| `\nabla \partial \epsilon \pi \sigma …` | LaTeX names, if easier to type |

Plain ASCII passes through unchanged. The palettes only offer glyphs the CASIO font can represent.

## Limitations

- **G1E / G2E / G3E** are supported. The legacy site's FLS / XCP / CAT formats are *not*
  implemented (they are unimplemented in the Python reference too).
- Not every Unicode character has a CASIO mapping (e.g. `∞`, `α`). The preview reports these; the
  Python reference behaves identically.
- An empty note body (`\note{T}{}`) is degenerate in EactMaker — give notes a body.

## Architecture

| Path | What |
|------|------|
| `src/lib/casio/` | TypeScript encoder — `encode`, `note`, `container`, `decode`, `parse`, `chars`, `index`. A faithful port of `casio_translate.py`, plus `parse`/`decodeMarkup` for import. |
| `src/lib/casio/chars.generated.json` | Unicode↔CASIO maps, generated from `chars.toml`. |
| `scripts/gen-chars.mjs` | Build step that produces the JSON (`npm run gen:chars`). |
| `scripts/parity.ts` | Byte-parity test vs. the Python reference (`npm test`). |
| `scripts/parity-roundtrip.ts` | Import round-trip test: build→parse→build is byte-identical (`npm test`). |
| `src/components/EactMaker.tsx` | The editor UI (client-only). |

Everything runs in the browser; there is no backend. See [`AGENTS.md`](AGENTS.md) for the format
internals and contributor notes, and [`casio-eactgen-py`](https://github.com/navarroaxel/casio-eactgen-py) for the reference
implementation and the full reverse-engineered binary-format spec.

### Scripts

```bash
npm run dev            # dev server
npm run gen:chars      # regenerate chars.generated.json from chars.toml
npm test               # byte-parity vs the Python reference + import round-trip
npm run test:roundtrip # just the build→parse→build byte round-trip
npm run build          # production build
npm run lint           # eslint
```

## Credits

- Character table: the [Cahute](https://cahute.org) project (Thomas Touhey), CeCILL 2.1.
- Format inspired by / verified against [EactMaker](https://tools.planet-casio.com/EactMaker/)
  by Helder7 and Ziqumu, and SimonLothar's reverse-engineering work.

## Disclaimer

CASIO and fx-9860G are trademarks of CASIO Computer Co., Ltd. This is an independent, unofficial
tool. Keep backups of the files on your calculator.
