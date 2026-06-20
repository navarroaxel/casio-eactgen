"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildEact,
  decode,
  encodeLine,
  splitlines,
  type EactFormat,
} from "@/lib/casio";
import { applySnippet, type Snippet } from "@/lib/insertAtCaret";
import { PALETTES } from "@/lib/palettes";
import { GitHubLink } from "./GitHubLink";

const STORAGE_KEY = "eactmaker.project.v1";

interface Project {
  title: string;
  format: EactFormat;
  compatibility: boolean;
  content: string;
}

interface MathButton extends Snippet {
  label: string;
  title: string;
  /** force the snippet onto its own line (used by \note). */
  ownLine?: boolean;
}

const MATH_BUTTONS: MathButton[] = [
  { label: "√▢", title: "Square root — √a", pre: "\\sqrt{", post: "}" },
  { label: "a⁄b", title: "Fraction — a over b", pre: "\\frac{", post: "}{}" },
  { label: "x▾", title: "Subscript — xₐ", pre: "_{", post: "}" },
  { label: "x▴", title: "Superscript / power — xᵃ", pre: "^{", post: "}" },
  {
    label: "Σ",
    title: "Summation — Σ of the first n (variable k, from 0)",
    pre: "\\sum{",
    post: "}{k}{0}{}",
  },
  { label: "[▦]", title: "Matrix 2×3", pre: "\\mat{", post: "&&}{&&}" },
  {
    label: "logₐ",
    title: "Logarithm — log base a of b",
    pre: "\\log{",
    post: "}{}",
  },
  {
    label: "|a|",
    title: "Absolute value / modulus of a",
    pre: "\\abs{",
    post: "}",
  },
  {
    label: "d⁄dx",
    title: "Derivative of a w.r.t. x",
    pre: "\\diff{",
    post: "}{x}",
  },
  {
    label: "d²⁄dx²",
    title: "Second derivative of a w.r.t. x",
    pre: "\\diff2{",
    post: "}{x}",
  },
  {
    label: "∫",
    title: "Integral — from a to b of c",
    pre: "\\int{",
    post: "}{}{}",
  },
  {
    label: "🗒 Note",
    title: "Note strip — \\note{title}{body} (own line)",
    pre: "\\note{",
    post: "}{}",
    ownLine: true,
  },
];

const FORMATS: { value: EactFormat; label: string }[] = [
  { value: "g2e", label: "G2E" },
  { value: "g1e", label: "G1E" },
];

function downloadBlob(name: string, data: ArrayBuffer | string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const safeName = (s: string, fallback: string) =>
  (s.trim() || fallback).replace(/[^\w.-]+/g, "_");

function loadProject(): Project {
  const fallback: Project = {
    title: "",
    format: "g2e",
    compatibility: false,
    content: "",
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Project>;
    return {
      title: typeof p.title === "string" ? p.title : "",
      format: p.format === "g1e" ? "g1e" : "g2e",
      compatibility: Boolean(p.compatibility),
      content: typeof p.content === "string" ? p.content : "",
    };
  } catch {
    return fallback;
  }
}

export default function EactMaker() {
  // This component renders client-only (see EactMakerClient), so reading
  // localStorage in the lazy initializers is safe and avoids hydration mismatch.
  const [title, setTitle] = useState(() => loadProject().title);
  const [format, setFormat] = useState<EactFormat>(() => loadProject().format);
  const [compatibility, setCompatibility] = useState(
    () => loadProject().compatibility,
  );
  const [content, setContent] = useState(() => loadProject().content);
  const [activeTab, setActiveTab] = useState(PALETTES[0].id);
  const [status, setStatus] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // Persist to localStorage as the user works.
  useEffect(() => {
    const p: Project = { title, format, compatibility, content };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [title, format, compatibility, content]);

  // Apply a deferred caret position after a programmatic insert.
  useEffect(() => {
    if (pendingCaret.current == null) return;
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [content]);

  const insert = useCallback(
    (snip: Snippet, ownLine = false) => {
      const ta = taRef.current;
      const selStart = ta ? ta.selectionStart : content.length;
      const selEnd = ta ? ta.selectionEnd : content.length;
      let value = content;
      let s = selStart;
      let e = selEnd;
      // For own-line snippets (\note), drop to a fresh line if mid-line.
      if (ownLine && s > 0 && value[s - 1] !== "\n") {
        value = value.slice(0, s) + "\n" + value.slice(s);
        s += 1;
        e += 1;
      }
      const res = applySnippet(value, s, e, snip);
      pendingCaret.current = res.caret;
      setContent(res.value);
    },
    [content],
  );

  // Live encode: byte size + per-line decoded preview + first error.
  const analysis = useMemo(() => {
    const lines = splitlines(content);
    const preview: { text: string; note: boolean }[] = [];
    let error: string | null = null;
    try {
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (ln.startsWith("\\note{")) {
          preview.push({ text: ln, note: true });
          encodeLine(ln, compatibility); // validate
        } else {
          const [bytes] = encodeLine(ln, compatibility);
          preview.push({ text: decode(bytes) || " ", note: false });
        }
      }
      const bytes = buildEact(title, content, { literalSuper: compatibility });
      return { size: bytes.length, lineCount: lines.length, preview, error };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      return { size: null, lineCount: lines.length, preview, error };
    }
  }, [content, compatibility, title]);

  const handleConvert = () => {
    try {
      const bytes = buildEact(title, content, { literalSuper: compatibility });
      downloadBlob(
        `${safeName(title, "eact")}.${format}`,
        bytes.slice().buffer,
        "application/octet-stream",
      );
      setStatus(
        `Generated ${safeName(title, "eact")}.${format} — ${bytes.length} bytes`,
      );
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSave = () => {
    const p: Project = { title, format, compatibility, content };
    downloadBlob(
      `${safeName(title, "project")}.eam.json`,
      JSON.stringify(p, null, 2),
      "application/json",
    );
    setStatus("Project saved");
  };

  const handleLoadFile = async (file: File) => {
    try {
      const p = JSON.parse(await file.text()) as Partial<Project>;
      setTitle(typeof p.title === "string" ? p.title : "");
      setFormat(p.format === "g1e" ? "g1e" : "g2e");
      setCompatibility(Boolean(p.compatibility));
      setContent(typeof p.content === "string" ? p.content : "");
      setStatus(`Loaded ${file.name}`);
    } catch {
      setStatus("Could not load that file (expected a .eam.json project)");
    }
  };

  const titleOver = title.length > 8;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <Header />

      {/* Controls */}
      <section className="grid grid-cols-1 gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-start dark:border-white/10 dark:bg-white/[0.03]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. PHYSICS"
            maxLength={32}
            className="rounded-lg border border-black/15 bg-white px-3 py-2 font-mono outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
          />
          <span
            className={`text-xs ${titleOver ? "text-amber-600" : "text-black/40 dark:text-white/40"}`}
          >
            {titleOver
              ? `Only the first 8 chars are used (banner: "${title.slice(0, 8)}")`
              : "Up to 8 characters appear on the calculator"}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as EactFormat)}
            className="rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="hidden font-medium select-none sm:block" aria-hidden>
            &nbsp;
          </span>
          <label
            className="flex h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-black/15 px-3 text-sm select-none dark:border-white/15"
            title="Encode ² ³ as the power form (^) rather than the literal superscript glyph"
          >
            <input
              type="checkbox"
              checked={compatibility}
              onChange={(e) => setCompatibility(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            <span>Compatibility mode</span>
          </label>
        </div>
      </section>

      {/* Math toolbar */}
      <section className="flex flex-wrap gap-2">
        {MATH_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            title={b.title}
            onClick={() => insert({ pre: b.pre, post: b.post }, b.ownLine)}
            className="rounded-lg border border-black/15 bg-white px-3 py-1.5 font-mono text-sm transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/15 dark:bg-white/[0.04] dark:hover:bg-emerald-500/10"
          >
            {b.label}
          </button>
        ))}
      </section>

      {/* Character palettes */}
      <section className="rounded-xl border border-black/10 dark:border-white/10">
        <div className="flex flex-wrap gap-1 border-b border-black/10 p-2 dark:border-white/10">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.id)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                activeTab === p.id
                  ? "bg-emerald-600 text-white"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto p-3">
          {PALETTES.filter((p) => p.id === activeTab).map((p) =>
            p.items.map((item) => (
              <button
                key={item.insert}
                type="button"
                title={item.title}
                onClick={() => insert({ pre: item.insert })}
                className="flex size-9 items-center justify-center rounded-md border border-black/10 bg-white text-base hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-emerald-500/10"
              >
                {item.label}
              </button>
            )),
          )}
        </div>
      </section>

      {/* Editor + preview */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Editor — one eActivity line per row
          </span>
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder={
              "Type your formulas, e.g.\n∇·E=\\frac{ρ}{ε₀}\nWe=½CV^2\n\\note{Tip}{Notes appear as a strip}"
            }
            className="h-72 w-full resize-y rounded-xl border border-black/15 bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Preview</span>
          <div className="flex h-72 flex-col overflow-hidden rounded-xl border border-black/15 dark:border-white/15">
            <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-black/[0.03] px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.04]">
              <span>{analysis.lineCount} line(s)</span>
              <span>
                {analysis.size != null ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {analysis.size} bytes · .{format}
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">
                    encode error
                  </span>
                )}
              </span>
            </div>
            {analysis.error ? (
              <div className="overflow-auto p-3 font-mono text-xs text-red-600 dark:text-red-400">
                {analysis.error}
              </div>
            ) : (
              <ol className="flex-1 overflow-auto p-3 font-mono text-sm">
                {analysis.preview.length === 0 && (
                  <li className="text-black/40 dark:text-white/40">
                    Nothing to preview yet.
                  </li>
                )}
                {analysis.preview.map((p, i) => (
                  <li
                    key={i}
                    className="border-b border-dashed border-black/5 py-0.5 break-words whitespace-pre-wrap last:border-0 dark:border-white/5"
                  >
                    {p.note ? (
                      <span className="text-sky-700 dark:text-sky-400">
                        🗒 {p.text}
                      </span>
                    ) : (
                      p.text
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConvert}
          disabled={analysis.size == null}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Convert &amp; download
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg border border-black/15 px-4 py-2.5 transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Save project
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-black/15 px-4 py-2.5 transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Load project
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.eam,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleLoadFile(f);
            e.target.value = "";
          }}
        />
        {status && (
          <span className="text-sm text-black/60 dark:text-white/60">
            {status}
          </span>
        )}
      </section>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-white/10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Eact <span className="text-emerald-600">Maker</span>
        </h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Build CASIO fx-9860G eActivity files in your browser.
        </p>
      </div>
      <GitHubLink />
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-black/10 pt-4 text-xs text-black/45 dark:border-white/10 dark:text-white/45">
      A modern re-creation of the original{" "}
      <a
        className="underline"
        href="https://tools.planet-casio.com/EactMaker/"
        target="_blank"
        rel="noreferrer"
      >
        EactMaker
      </a>{" "}
      by Helder7 &amp; Ziqumu. Output is byte-identical to EactMaker (G1E /
      G2E), generated entirely client-side from a reverse-engineered file
      format.
    </footer>
  );
}
