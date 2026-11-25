"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zipSync } from "fflate";
import { analyze } from "@/lib/analyze";
import type { EactFormat } from "@/lib/casio";
import { compileFile } from "@/lib/compile";
import { downloadBlob } from "@/lib/download";
import { errorMessage } from "@/lib/errorMessage";
import { importEactFiles } from "@/lib/importEacts";
import { applySnippet, type Snippet } from "@/lib/insertAtCaret";
import {
  loadProject,
  parseProjectFile,
  planExport,
  safeName,
  serializeProject,
  STORAGE_KEY,
  type Project,
} from "@/lib/project";
import * as actions from "@/lib/projectActions";
import { useLinkedFile } from "@/hooks/useLinkedFile";
import { useMappedFolder } from "@/hooks/useMappedFolder";
import { FileNavigator } from "./FileNavigator";
import { InsertToolbar } from "./InsertToolbar";
import { Footer, Header } from "./PageChrome";
import { Preview } from "./Preview";
import {
  OUTLINE_ACTION_BTN,
  PRIMARY_ACTION_BTN,
  WARN_ACTION_BTN,
} from "./styles";

export default function EactMaker() {
  // This component renders client-only (see EactMakerClient), so reading
  // localStorage in the lazy initializer is safe and avoids hydration mismatch.
  const [project, setProject] = useState<Project>(() => loadProject());
  const [status, setStatus] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const { format, compatibility } = project;
  const activeFile =
    project.files.find((f) => f.id === project.ui.activeId) ?? project.files[0];
  const { title, content } = activeFile;

  const linked = useLinkedFile({
    project,
    setProject,
    setStatus,
    suggestedName: title,
  });
  const mapped = useMappedFolder({ project, setStatus });

  // --- Project edits (pure transitions live in lib/projectActions) ---
  const setFormat = useCallback(
    (f: EactFormat) => setProject((p) => actions.setFormat(p, f)),
    [],
  );
  const setCompatibility = useCallback(
    (v: boolean) => setProject((p) => actions.setCompatibility(p, v)),
    [],
  );
  const setContent = useCallback(
    (text: string) =>
      setProject((p) =>
        p.ui.activeId
          ? actions.updateFile(p, p.ui.activeId, { content: text })
          : p,
      ),
    [],
  );
  const renameFile = useCallback(
    (id: string, t: string) =>
      setProject((p) => actions.updateFile(p, id, { title: t })),
    [],
  );
  const selectFile = useCallback(
    (id: string) => setProject((p) => actions.selectFile(p, id)),
    [],
  );
  const toggleNav = useCallback(
    () => setProject((p) => actions.toggleNav(p)),
    [],
  );
  const addFile = useCallback(
    (folder: string | null = null) =>
      setProject((p) => actions.addFile(p, folder)),
    [],
  );
  const addFolder = useCallback(
    (name: string) => setProject((p) => actions.addFolder(p, name)),
    [],
  );
  const deleteFile = useCallback(
    (id: string) => setProject((p) => actions.deleteFile(p, id)),
    [],
  );
  const moveFile = useCallback(
    (id: string, folder: string | null) =>
      setProject((p) => actions.moveFile(p, id, folder)),
    [],
  );
  const renameFolder = useCallback(
    (name: string, next: string) =>
      setProject((p) => actions.renameFolder(p, name, next)),
    [],
  );
  const deleteFolder = useCallback(
    (name: string) => setProject((p) => actions.deleteFolder(p, name)),
    [],
  );

  // Persist to localStorage as the user works. This stays the instant,
  // always-on safety net; the linked disk file is a second target.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeProject(project));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [project]);

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
      let value = content;
      let s = ta ? ta.selectionStart : content.length;
      let e = ta ? ta.selectionEnd : content.length;
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
    [content, setContent],
  );

  const analysis = useMemo(
    () => analyze(title, content, { format, compatibility }),
    [title, content, format, compatibility],
  );

  // --- Export / import / save handlers ---
  const handleConvert = () => {
    try {
      const bytes = compileFile(activeFile, { format, compatibility });
      const name = `${safeName(title, "eact")}.${format}`;
      downloadBlob(name, bytes.slice().buffer, "application/octet-stream");
      setStatus(`Generated ${name} — ${bytes.length} bytes`);
    } catch (err) {
      setStatus(`Error: ${errorMessage(err)}`);
    }
  };

  const handleExportAll = () => {
    try {
      const plan = planExport(project.files, format);
      const byId = new Map(project.files.map((f) => [f.id, f]));
      const zipInput: Record<string, Uint8Array> = {};
      let total = 0;
      for (const entry of plan) {
        const file = byId.get(entry.id)!;
        try {
          const bytes = compileFile(file, { format, compatibility });
          zipInput[entry.path] = bytes;
          total += bytes.length;
        } catch (err) {
          throw new Error(
            `"${file.title.trim() || "Untitled"}": ${errorMessage(err)}`,
          );
        }
      }
      const zipped = zipSync(zipInput);
      downloadBlob("eactivities.zip", zipped.slice().buffer, "application/zip");
      const renamed = plan.filter((e) => e.renamed).length;
      setStatus(
        `Exported ${plan.length} file(s) · ${total} bytes` +
          (renamed ? ` · ${renamed} renamed to avoid name clashes` : ""),
      );
    } catch (err) {
      setStatus(`Error: ${errorMessage(err)}`);
    }
  };

  // Fallback (no File System Access): one-shot download / upload.
  const handleSave = () => {
    downloadBlob(
      `${safeName(title, "project")}.eam.json`,
      serializeProject(project),
      "application/json",
    );
    setStatus("Project saved");
  };

  const handleLoadFile = async (file: File) => {
    try {
      setProject(parseProjectFile(await file.text()));
      setStatus(`Loaded ${file.name}`);
    } catch {
      setStatus("Could not load that file (expected a .eam.json project)");
    }
  };

  const handleImportEact = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const { files: imported, message } = await importEactFiles(list);
    setProject((p) => actions.appendFiles(p, imported));
    setStatus(message);
  };

  const { dirSupported, dirStatus, dirName } = mapped;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <Header />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <FileNavigator
          files={project.files}
          folders={project.folders}
          activeId={project.ui.activeId}
          open={project.ui.navOpen}
          format={format}
          compatibility={compatibility}
          onToggle={toggleNav}
          onSelect={selectFile}
          onRenameFile={renameFile}
          onSetFormat={setFormat}
          onSetCompatibility={setCompatibility}
          onNewFile={addFile}
          onNewFolder={addFolder}
          onDeleteFile={deleteFile}
          onMoveFile={moveFile}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onSave={handleSave}
          onLoad={handleLoadFile}
          onImport={handleImportEact}
          fsSupported={linked.fsSupported}
          linkStatus={linked.linkStatus}
          linkedName={linked.linkedName}
          onLinkSave={linked.linkSave}
          onOpenDisk={linked.openFromDisk}
          onReconnect={linked.reconnect}
          onUnlink={linked.unlink}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <InsertToolbar onInsert={insert} />

          {/* Editor (per-file) */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Editor —{" "}
                <span className="font-mono">{title.trim() || "Untitled"}</span>
                <span className="font-normal text-black/40 dark:text-white/40">
                  {" "}
                  · one line per row (double-click the file name to rename)
                </span>
              </span>
              <textarea
                ref={taRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                placeholder={
                  "Type your formulas, e.g.\n∇·E=\\frac{ρ}{ε₀}\nWe=½CV^2\n\\note{Tip}{Notes appear as a strip}"
                }
                className="h-64 w-full resize-y rounded-xl border border-black/15 bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-emerald-500 dark:border-white/15 dark:bg-black"
              />
            </div>

            <Preview analysis={analysis} format={format} />
          </section>

          {/* Actions */}
          <section className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportAll}
              className={PRIMARY_ACTION_BTN}
            >
              Export all (.zip)
            </button>
            <button
              type="button"
              onClick={handleConvert}
              disabled={analysis.size == null}
              className={`${OUTLINE_ACTION_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Download this file (.{format})
            </button>
            {dirSupported && dirStatus === "none" && (
              <button
                type="button"
                onClick={mapped.mapFolder}
                title="Pick a folder and write the compiled files there, re-syncing on change"
                className={OUTLINE_ACTION_BTN}
              >
                Sync to folder…
              </button>
            )}
            {dirSupported && dirStatus === "linked" && (
              <span
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
                title={`Compiled files auto-sync into ${dirName}`}
              >
                <span aria-hidden>🔄</span>
                <span className="max-w-[12rem] truncate">
                  Syncing to {dirName}
                </span>
                <button
                  type="button"
                  onClick={mapped.unmap}
                  title="Stop syncing to this folder"
                  className="rounded px-1 text-black/40 hover:bg-black/10 dark:text-white/40 dark:hover:bg-white/10"
                >
                  ×
                </button>
              </span>
            )}
            {dirSupported && dirStatus === "needs-permission" && (
              <button
                type="button"
                onClick={mapped.reconnect}
                title="Re-grant access to resume syncing compiled files"
                className={WARN_ACTION_BTN}
              >
                Reconnect {dirName}
              </button>
            )}
            {status && (
              <span className="text-sm text-black/60 dark:text-white/60">
                {status}
              </span>
            )}
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
