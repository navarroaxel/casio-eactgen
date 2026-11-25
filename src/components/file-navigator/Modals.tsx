import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { EactFormat } from "@/lib/casio";
import { BANNER_LENGTH } from "./types";
import { PRIMARY_BTN, SECONDARY_BTN } from "./styles";

const FORMATS: { value: EactFormat; label: string }[] = [
  { value: "g2e", label: "G2E" },
  { value: "g1e", label: "G1E" },
  { value: "g3e", label: "G3E" },
];

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  // Close on Escape regardless of which control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="mb-3 text-sm font-medium">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function TitleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const over = value.length > BANNER_LENGTH;
  const submit = () => {
    onSave(value);
    onClose();
  };
  return (
    <ModalShell title="Rename file" onClose={onClose}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="e.g. PHYSICS"
        maxLength={32}
        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 font-mono outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
      />
      <span
        className={`mt-1 block text-xs ${over ? "text-amber-600" : "text-black/40 dark:text-white/40"}`}
      >
        {over
          ? `Only the first ${BANNER_LENGTH} chars are used (banner: "${value.slice(0, BANNER_LENGTH)}")`
          : `Up to ${BANNER_LENGTH} characters — the file name shown on the calculator`}
      </span>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>
          Cancel
        </button>
        <button type="button" onClick={submit} className={PRIMARY_BTN}>
          Save
        </button>
      </div>
    </ModalShell>
  );
}

export function SettingsModal({
  format,
  compatibility,
  onSetFormat,
  onSetCompatibility,
  onClose,
}: {
  format: EactFormat;
  compatibility: boolean;
  onSetFormat: (format: EactFormat) => void;
  onSetCompatibility: (value: boolean) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Project settings" onClose={onClose}>
      <p className="mb-3 text-xs text-black/40 dark:text-white/40">
        These apply to every file in the project.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Format</span>
        <select
          value={format}
          onChange={(e) => onSetFormat(e.target.value as EactFormat)}
          className="rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
        >
          {FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label
        className="mt-3 flex cursor-pointer items-center gap-2 text-sm select-none"
        title="Encode ² ³ as the power form (^) rather than the literal superscript glyph"
      >
        <input
          type="checkbox"
          checked={compatibility}
          onChange={(e) => onSetCompatibility(e.target.checked)}
          className="size-4 accent-emerald-600"
        />
        <span>Compatibility mode</span>
      </label>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className={PRIMARY_BTN}>
          Done
        </button>
      </div>
    </ModalShell>
  );
}
