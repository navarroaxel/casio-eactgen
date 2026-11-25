"use client";

import { useMemo, useState } from "react";
import type { EactFormat } from "@/lib/casio";
import type { EactFile } from "@/lib/project";
import { FileRow, fileName } from "./file-navigator/FileRow";
import { FolderSection } from "./file-navigator/FolderSection";
import {
  ConfirmModal,
  NameModal,
  SettingsModal,
  TitleModal,
} from "./file-navigator/Modals";
import { ProjectFooter } from "./file-navigator/ProjectFooter";
import { ACCENT_BTN } from "./file-navigator/styles";
import type { LinkStatus } from "./file-navigator/types";
import { useCollapsedFolders } from "./file-navigator/useCollapsedFolders";

export type { LinkStatus };

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
  onNewFolder: (name: string) => void;
  onDeleteFile: (id: string) => void;
  onMoveFile: (id: string, folder: string | null) => void;
  onRenameFolder: (name: string, next: string) => void;
  onDeleteFolder: (name: string) => void;
  onSetFormat: (format: EactFormat) => void;
  onSetCompatibility: (value: boolean) => void;
  // Fallback (download/upload) — used when the File System Access API is absent.
  onSave: () => void;
  onLoad: (file: File) => void;
  // Import compiled .g1e/.g2e/.g3e eActivities back into editable files.
  onImport: (files: FileList) => void;
  // File System Access: link the project to a file on disk and auto-save there.
  fsSupported: boolean;
  linkStatus: LinkStatus;
  linkedName: string | null;
  onLinkSave: () => void;
  onOpenDisk: () => void;
  onReconnect: () => void;
  onUnlink: () => void;
}

/** Folders displayed alphabetically (case-insensitive, natural number order). */
const sortFolders = (folders: string[]) =>
  [...folders].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
  );

export function FileNavigator(props: FileNavigatorProps) {
  const { files, activeId, open } = props;
  const folders = useMemo(() => sortFolders(props.folders), [props.folders]);
  const collapse = useCollapsedFolders(folders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<
    { kind: "new" } | { kind: "rename"; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState<EactFile | null>(null);
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
        className="flex shrink-0 items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-xs transition hover:bg-black/5 sm:flex-col sm:px-2 sm:py-3 dark:border-white/10 dark:hover:bg-white/10"
      >
        <span aria-hidden>▸</span>
        <span className="truncate sm:tracking-wide sm:[writing-mode:vertical-rl]">
          Files ({files.length}){active ? ` · ${fileName(active)}` : ""}
        </span>
      </button>
    );
  }

  const renderRow = (f: EactFile) => (
    <FileRow
      key={f.id}
      file={f}
      folders={folders}
      active={f.id === activeId}
      onSelect={handleSelect}
      onEdit={setEditingId}
      onDelete={setDeleting}
      onMove={props.onMoveFile}
    />
  );

  const allLabel = collapse.allCollapsed
    ? "Expand all folders"
    : "Collapse all folders";

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
            className={`flex-1 ${ACCENT_BTN}`}
          >
            + File
          </button>
          <button
            type="button"
            onClick={() => setFolderDialog({ kind: "new" })}
            title="Create a new folder"
            className={`flex-1 ${ACCENT_BTN}`}
          >
            + Folder
          </button>
          {folders.length > 0 && (
            <button
              type="button"
              onClick={collapse.toggleAll}
              title={allLabel}
              aria-label={allLabel}
              className={ACCENT_BTN}
            >
              {collapse.allCollapsed ? "⊞" : "⊟"}
            </button>
          )}
        </div>

        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {files.filter((f) => f.folder === null).map(renderRow)}

          {folders.map((folder) => (
            <FolderSection
              key={folder}
              name={folder}
              collapsed={collapse.isCollapsed(folder)}
              onToggle={() => collapse.toggle(folder)}
              onNewFile={() => {
                // Reveal the folder so the new file's row is visible.
                collapse.expand(folder);
                props.onNewFile(folder);
              }}
              onRename={() => setFolderDialog({ kind: "rename", name: folder })}
              onDelete={() => props.onDeleteFolder(folder)}
            >
              {files.filter((f) => f.folder === folder).map(renderRow)}
            </FolderSection>
          ))}
        </ul>

        <ProjectFooter
          onSave={props.onSave}
          onLoad={props.onLoad}
          onImport={props.onImport}
          fsSupported={props.fsSupported}
          linkStatus={props.linkStatus}
          linkedName={props.linkedName}
          onLinkSave={props.onLinkSave}
          onOpenDisk={props.onOpenDisk}
          onReconnect={props.onReconnect}
          onUnlink={props.onUnlink}
        />
      </aside>

      {editing && (
        <TitleModal
          initial={editing.title}
          onSave={(t) => props.onRenameFile(editing.id, t)}
          onClose={() => setEditingId(null)}
        />
      )}
      {folderDialog && (
        <NameModal
          title={folderDialog.kind === "new" ? "New folder" : "Rename folder"}
          initial={folderDialog.kind === "rename" ? folderDialog.name : ""}
          placeholder="Folder name"
          submitLabel={folderDialog.kind === "new" ? "Create" : "Rename"}
          validate={(v) =>
            props.folders.includes(v) &&
            !(folderDialog.kind === "rename" && v === folderDialog.name)
              ? "A folder with that name already exists"
              : null
          }
          onSubmit={(v) =>
            folderDialog.kind === "new"
              ? props.onNewFolder(v)
              : props.onRenameFolder(folderDialog.name, v)
          }
          onClose={() => setFolderDialog(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete file"
          message={`Delete "${fileName(deleting)}"? This can't be undone.`}
          onConfirm={() => props.onDeleteFile(deleting.id)}
          onClose={() => setDeleting(null)}
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
