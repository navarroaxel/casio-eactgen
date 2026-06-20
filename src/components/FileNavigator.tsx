"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { EactFormat } from "@/lib/casio";
import type { EactFile } from "@/lib/project";

interface FileNavigatorProps {
  files: EactFile[];
  folders: string[];
  activeId: string | null;
  open: boolean;
  format: EactFormat;
  compatibility: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onRenameFile: (id: string, title: string) => void;
  onNewFile: (folder: string | null) => void;
  onNewFolder: () => void;
  onDeleteFile: (id: string) => void;
  onMoveFile: (id: string, folder: string | null) => void;
  onRenameFolder: (name: string) => void;
  onDeleteFolder: (name: string) => void;
  onSetFormat: (format: EactFormat) => void;
  onSetCompatibility: (value: boolean) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
}

const FORMATS: { value: EactFormat; label: string }[] = [
  { value: "g2e", label: "G2E" },
  { value: "g1e", label: "G1E" },
];

const fileName = (f: EactFile) => f.title.trim() || "Untitled";

export function FileNavigator(props: FileNavigatorProps) {
  const { files, folders, activeId, open } = props;
  const loadRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const editing = editingId ? files.find((f) => f.id === editingId) : undefined;

  const handleSelect = (id: string) => {
    props.onSelect(id);
    // On mobile the navigator is a full-screen drawer — close it after picking
    // a file so the editor is visible.
    if (!window.matchMedia("(min-width: 640px)").matches) props.onToggle();
  };

  if (!open) {
    const active = files.find((f) => f.id === activeId);
    return (
      <button
        type="button"
        onClick={props.onToggle}
        title="Show files"
        className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-black/10 px-2 py-3 text-xs transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      >
        <span aria-hidden>▸</span>
        <span className="[writing-mode:vertical-rl] tracking-wide">
          Files ({files.length})
          {active ? ` · ${fileName(active)}` : ""}
        </span>
      </button>
    );
  }

  const rootFiles = files.filter((f) => f.folder === null);

  return (
    <>
    {/* Mobile: dim the page behind the full-screen drawer. */}
    <div
      className="fixed inset-0 z-40 bg-black/40 sm:hidden"
      aria-hidden
      onClick={props.onToggle}
    />
    <aside className="fixed inset-y-0 left-0 z-50 flex w-full flex-col gap-2 border-r border-black/10 bg-white p-3 sm:static sm:z-auto sm:w-60 sm:shrink-0 sm:self-stretch sm:rounded-xl sm:border sm:bg-transparent sm:p-2 dark:border-white/10 dark:bg-neutral-900 sm:dark:bg-transparent">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">Files</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Project settings"
            className="rounded-md px-1.5 py-0.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            ⚙
          </button>
          <button
            type="button"
            onClick={props.onToggle}
            title="Hide files"
            className="rounded-md px-1.5 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
          >
            ◂
          </button>
        </div>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => props.onNewFile(null)}
          title="New file at the project root"
          className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-emerald-500/10"
        >
          + File
        </button>
        <button
          type="button"
          onClick={props.onNewFolder}
          title="Create a new folder"
          className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-emerald-500/10"
        >
          + Folder
        </button>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {rootFiles.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            onEdit={setEditingId}
            {...props}
            onSelect={handleSelect}
          />
        ))}

        {folders.map((folder) => (
          <li key={folder} className="mt-1">
            <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium">
              <span className="mr-auto truncate" title={folder}>
                📁 {folder}
              </span>
              <button
                type="button"
                onClick={() => props.onNewFile(folder)}
                title={`New file in ${folder}`}
                className="rounded px-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => props.onRenameFolder(folder)}
                title={`Rename ${folder}`}
                className="rounded px-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => props.onDeleteFolder(folder)}
                title={`Delete folder "${folder}" (its files move to the root)`}
                className="rounded px-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <ul className="ml-3 flex flex-col gap-0.5 border-l border-black/10 pl-1 dark:border-white/10">
              {files
                .filter((f) => f.folder === folder)
                .map((f) => (
                  <FileRow
            key={f.id}
            file={f}
            onEdit={setEditingId}
            {...props}
            onSelect={handleSelect}
          />
                ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex gap-1 border-t border-black/10 pt-2 dark:border-white/10">
        <button
          type="button"
          onClick={props.onSave}
          title="Download the whole project as a .eam.json file"
          className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Save project
        </button>
        <button
          type="button"
          onClick={() => loadRef.current?.click()}
          title="Load a .eam.json project file"
          className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Load project
        </button>
        <input
          ref={loadRef}
          type="file"
          accept=".json,.eam,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onLoad(f);
            e.target.value = "";
          }}
        />
      </div>
    </aside>

      {editing && (
        <TitleModal
          initial={editing.title}
          onSave={(t) => props.onRenameFile(editing.id, t)}
          onClose={() => setEditingId(null)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          format={props.format}
          compatibility={props.compatibility}
          onSetFormat={props.onSetFormat}
          onSetCompatibility={props.onSetCompatibility}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

function FileRow({
  file,
  folders,
  activeId,
  onSelect,
  onEdit,
  onDeleteFile,
  onMoveFile,
}: { file: EactFile; onEdit: (id: string) => void } & Pick<
  FileNavigatorProps,
  "folders" | "activeId" | "onSelect" | "onDeleteFile" | "onMoveFile"
>) {
  const active = file.id === activeId;
  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(file.id)}
        onDoubleClick={() => onEdit(file.id)}
        className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm transition ${
          active
            ? "bg-emerald-600 text-white"
            : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
        title={`${fileName(file)} — double-click to rename`}
      >
        {fileName(file)}
      </button>
      <select
        value={file.folder ?? ""}
        onChange={(e) => onMoveFile(file.id, e.target.value || null)}
        title="Move to folder"
        className="max-w-[5rem] rounded border border-black/15 bg-transparent px-1 py-0.5 text-xs opacity-0 transition group-hover:opacity-100 focus:opacity-100 dark:border-white/15"
      >
        <option value="">(root)</option>
        {folders.map((fl) => (
          <option key={fl} value={fl}>
            {fl}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Delete "${fileName(file)}"?`)) onDeleteFile(file.id);
        }}
        title="Delete file"
        className="rounded px-1 text-sm opacity-0 transition group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
      >
        ×
      </button>
    </li>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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

function TitleModal({
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
  const over = value.length > 8;
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
          ? `Only the first 8 chars are used (banner: "${value.slice(0, 8)}")`
          : "Up to 8 characters — the file name shown on the calculator"}
      </span>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function SettingsModal({
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Done
        </button>
      </div>
    </ModalShell>
  );
}
