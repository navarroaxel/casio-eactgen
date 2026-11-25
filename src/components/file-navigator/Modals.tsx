import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { EactFormat } from "@/lib/casio";
import { BANNER_LENGTH } from "./types";
import { PRIMARY_BTN, SECONDARY_BTN } from "./styles";

const FORMATS: { value: EactFormat; label: string }[] = [
  { value: "g2e", label: "G2E" },
  { value: "g1e", label: "G1E" },
  { value: "g3e", label: "G3E" },
];

/**
 * Modal built on a native <dialog> opened with showModal(): the browser traps
 * Tab inside it, makes the rest of the page inert, and handles Escape (via the
 * `cancel` event). Focus is returned to the opener when the dialog unmounts.
 */
export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // let React unmount us rather than the browser
        onClose();
      }}
      // A click on the ::backdrop targets the <dialog> itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-black/10 bg-white p-0 text-inherit shadow-xl backdrop:bg-black/40 dark:border-white/10 dark:bg-neutral-900"
    >
      {/* Padding lives on this inner box so a click on it never targets the
          <dialog> itself — only the backdrop does. */}
      <div className="p-4">
        <h2 id={titleId} className="mb-3 text-sm font-medium">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
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
          // Enter that accepts an IME candidate must not submit.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
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

/** Single-line name entry (folder names). `validate` returns an error or null. */
export function NameModal({
  title,
  initial = "",
  placeholder,
  submitLabel = "Save",
  validate,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const trimmed = value.trim();
  const error = trimmed ? (validate?.(trimmed) ?? null) : null;
  const canSubmit = trimmed !== "" && error === null;
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    onClose();
  };
  return (
    <ModalShell title={title} onClose={onClose}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter that accepts an IME candidate must not submit.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
        placeholder={placeholder}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-amber-600">
          {error}
        </span>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={`${PRIMARY_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {submitLabel}
        </button>
      </div>
    </ModalShell>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <p className="text-sm">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={PRIMARY_BTN}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
