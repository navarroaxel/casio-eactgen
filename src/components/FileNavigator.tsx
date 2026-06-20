"use client";

import type { EactFile } from "@/lib/project";

interface FileNavigatorProps {
  files: EactFile[];
  folders: string[];
  activeId: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onNewFile: (folder: string | null) => void;
  onNewFolder: () => void;
  onDeleteFile: (id: string) => void;
  onMoveFile: (id: string, folder: string | null) => void;
  onRenameFolder: (name: string) => void;
  onDeleteFolder: (name: string) => void;
}

const fileName = (f: EactFile) => f.title.trim() || "Untitled";

export function FileNavigator(props: FileNavigatorProps) {
  const { files, folders, activeId, open } = props;

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
    <aside className="flex w-60 shrink-0 flex-col gap-2 self-stretch rounded-xl border border-black/10 p-2 dark:border-white/10">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">Files</span>
        <button
          type="button"
          onClick={props.onToggle}
          title="Hide files"
          className="rounded-md px-1.5 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
        >
          ◂
        </button>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => props.onNewFile(null)}
          className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-emerald-500/10"
        >
          + File
        </button>
        <button
          type="button"
          onClick={props.onNewFolder}
          className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-white/15 dark:hover:bg-emerald-500/10"
        >
          + Folder
        </button>
      </div>

      <ul className="flex flex-col gap-0.5 overflow-y-auto">
        {rootFiles.map((f) => (
          <FileRow key={f.id} file={f} {...props} />
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
                title={`Delete folder (files move to root)`}
                className="rounded px-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <ul className="ml-3 flex flex-col gap-0.5 border-l border-black/10 pl-1 dark:border-white/10">
              {files
                .filter((f) => f.folder === folder)
                .map((f) => (
                  <FileRow key={f.id} file={f} {...props} />
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function FileRow({
  file,
  folders,
  activeId,
  onSelect,
  onDeleteFile,
  onMoveFile,
}: { file: EactFile } & Pick<
  FileNavigatorProps,
  "folders" | "activeId" | "onSelect" | "onDeleteFile" | "onMoveFile"
>) {
  const active = file.id === activeId;
  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(file.id)}
        className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm transition ${
          active
            ? "bg-emerald-600 text-white"
            : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
        title={fileName(file)}
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
