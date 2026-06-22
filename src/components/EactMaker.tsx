"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildEact,
  decode,
  encodeLine,
  splitlines,
  type EactFormat,
} from "@/lib/casio";
import { zipSync } from "fflate";
import { applySnippet, type Snippet } from "@/lib/insertAtCaret";
import { PALETTES } from "@/lib/palettes";
import {
  loadProject,
  newFile,
  parseProjectFile,
  planExport,
  safeName,
  serializeProject,
  STORAGE_KEY,
  type EactFile,
  type Project,
} from "@/lib/project";
import {
  clearDirHandle,
  clearHandle,
  ensureRW,
  isDirPickerSupported,
  isFsAccessSupported,
  loadDirHandle,
  loadHandle,
  pickDirectory,
  pickOpenFile,
  pickSaveFile,
  removeFileInDir,
  saveDirHandle,
  saveHandle,
  writeFile,
  writeFileInDir,
} from "@/lib/fsAccess";
import { FileNavigator, type LinkStatus } from "./FileNavigator";
import { GitHubLink } from "./GitHubLink";

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

// Remember which compiled paths we wrote into the mapped folder, so orphan
// cleanup keeps working across reloads (and never touches files we didn't write).
const SYNC_PATHS_KEY = "eactmaker.syncpaths.v1";
function loadSyncedPaths(): string[] {
  try {
    const raw = localStorage.getItem(SYNC_PATHS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}
function persistSyncedPaths(paths: string[]) {
  try {
    localStorage.setItem(SYNC_PATHS_KEY, JSON.stringify(paths));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

function syncMessage(dir: string, ok: number, removed: number, errors: string[]) {
  return (
    `Synced ${ok} file(s) to ${dir}` +
    (removed ? ` · ${removed} orphan(s) removed` : "") +
    (errors.length ? ` · ${errors.length} skipped (encode error)` : "")
  );
}

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

export default function EactMaker() {
  // This component renders client-only (see EactMakerClient), so reading
  // localStorage in the lazy initializer is safe and avoids hydration mismatch.
  const [project, setProject] = useState<Project>(() => loadProject());
  const [activeTab, setActiveTab] = useState<string | null>(PALETTES[0].id);
  const [status, setStatus] = useState<string | null>(null);

  // Optional link to an .eam.json on disk (File System Access API). When linked
  // and permitted, the project auto-saves there in addition to localStorage —
  // point it at a Drive/Dropbox folder to sync. Handle lives in IndexedDB.
  const fsSupported = useMemo(() => isFsAccessSupported(), []);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("none");
  const [linkedName, setLinkedName] = useState<string | null>(null);

  // Optional mapping to an output directory on disk: the compiled .g2e/.g1e
  // files (one per project file, subfolders recreated) are written there and
  // re-synced on change — point it at a Drive folder to publish straight to it.
  const dirSupported = useMemo(() => isDirPickerSupported(), []);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [dirStatus, setDirStatus] = useState<LinkStatus>("none");
  const [dirName, setDirName] = useState<string | null>(null);
  // Paths we last wrote into the mapped folder. On each sync we delete the ones
  // no longer produced (moved/renamed/deleted files) so they aren't orphaned —
  // but only files *we* wrote, never pre-existing files in the chosen folder.
  const syncedPathsRef = useRef<string[]>([]);

  // Serialized text we last wrote to the linked file, to skip redundant writes
  // and to reconcile disk-vs-memory on mount (see the restore effect).
  const lastWrittenTextRef = useRef<string | null>(null);

  // Latest project, readable from mount-only effects without making them a
  // dependency (the restore effect must not re-run on every edit). The initial
  // useRef value already holds the mount-time project; this keeps it fresh.
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Latest-only write queues: a write that's already in flight finishes, then
  // the most recent pending payload runs — never an older one after a newer.
  const fileQueueRef = useRef<{ running: boolean; pending: string | null }>({
    running: false,
    pending: null,
  });
  const dirQueueRef = useRef<{ running: boolean; pending: boolean }>({
    running: false,
    pending: false,
  });

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const { format, compatibility } = project;
  const activeFile =
    project.files.find((f) => f.id === project.ui.activeId) ?? project.files[0];
  const title = activeFile.title;
  const content = activeFile.content;

  const setFormat = useCallback(
    (format: EactFormat) => setProject((p) => ({ ...p, format })),
    [],
  );
  const setCompatibility = useCallback(
    (compatibility: boolean) => setProject((p) => ({ ...p, compatibility })),
    [],
  );
  const updateActiveFile = useCallback((patch: Partial<EactFile>) => {
    setProject((p) => ({
      ...p,
      files: p.files.map((f) =>
        f.id === p.ui.activeId ? { ...f, ...patch } : f,
      ),
    }));
  }, []);
  const setContent = useCallback(
    (content: string) => updateActiveFile({ content }),
    [updateActiveFile],
  );

  // --- File navigator actions ---
  const renameFile = useCallback(
    (id: string, title: string) =>
      setProject((p) => ({
        ...p,
        files: p.files.map((f) => (f.id === id ? { ...f, title } : f)),
      })),
    [],
  );
  const selectFile = useCallback(
    (id: string) => setProject((p) => ({ ...p, ui: { ...p.ui, activeId: id } })),
    [],
  );
  const toggleNav = useCallback(
    () =>
      setProject((p) => ({ ...p, ui: { ...p.ui, navOpen: !p.ui.navOpen } })),
    [],
  );
  const addFile = useCallback(
    (folder: string | null = null) =>
      setProject((p) => {
        const f = newFile({ folder });
        return { ...p, files: [...p.files, f], ui: { ...p.ui, activeId: f.id } };
      }),
    [],
  );
  const addFolder = useCallback(() => {
    const name = window.prompt("New folder name")?.trim();
    if (!name) return;
    setProject((p) =>
      p.folders.includes(name) ? p : { ...p, folders: [...p.folders, name] },
    );
  }, []);
  const deleteFile = useCallback(
    (id: string) =>
      setProject((p) => {
        let files = p.files.filter((f) => f.id !== id);
        if (files.length === 0) files = [newFile()];
        const activeId =
          p.ui.activeId === id ? files[0].id : p.ui.activeId;
        return { ...p, files, ui: { ...p.ui, activeId } };
      }),
    [],
  );
  const moveFile = useCallback(
    (id: string, folder: string | null) =>
      setProject((p) => ({
        ...p,
        files: p.files.map((f) => (f.id === id ? { ...f, folder } : f)),
      })),
    [],
  );
  const renameFolder = useCallback((name: string) => {
    const next = window.prompt("Rename folder", name)?.trim();
    if (!next || next === name) return;
    setProject((p) => {
      if (p.folders.includes(next)) return p; // avoid merging into an existing folder
      return {
        ...p,
        folders: p.folders.map((fl) => (fl === name ? next : fl)),
        files: p.files.map((f) =>
          f.folder === name ? { ...f, folder: next } : f,
        ),
      };
    });
  }, []);
  const deleteFolder = useCallback(
    (name: string) =>
      setProject((p) => ({
        ...p,
        folders: p.folders.filter((fl) => fl !== name),
        files: p.files.map((f) =>
          f.folder === name ? { ...f, folder: null } : f,
        ),
      })),
    [],
  );

  // Persist to localStorage as the user works. This stays the instant,
  // always-on safety net; the linked disk file (below) is a second target.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeProject(project));
    } catch {
      /* quota / private mode — non-fatal */
    }
  }, [project]);

  // Serialize the project to the linked file, newest-payload-wins. Drops stale
  // in-flight writes so an older debounced save can't land after a newer one.
  const queueFileWrite = useCallback((text: string) => {
    const q = fileQueueRef.current;
    q.pending = text;
    if (q.running) return;
    q.running = true;
    (async () => {
      try {
        while (q.pending !== null) {
          const next = q.pending;
          q.pending = null;
          const handle = fileHandleRef.current;
          if (!handle) break;
          await writeFile(handle, next);
          lastWrittenTextRef.current = next;
        }
      } catch {
        // Lost access (file moved, permission revoked) — ask to reconnect.
        q.pending = null;
        setLinkStatus("needs-permission");
        const name = fileHandleRef.current?.name ?? "the linked file";
        setStatus(`Auto-save to ${name} failed — reconnect to resume`);
      } finally {
        q.running = false;
      }
    })();
  }, []);

  // Restore a previously linked file on mount. File System Access permission is
  // not persisted across loads, so unless the origin still holds it we surface a
  // "Reconnect" affordance rather than prompting without a user gesture. (IDB is
  // async so this must live in an effect — unrelated to the localStorage rule.)
  useEffect(() => {
    if (!fsSupported) return;
    let cancelled = false;
    loadHandle().then(async (handle) => {
      if (cancelled || !handle) return;
      fileHandleRef.current = handle;
      setLinkedName(handle.name);
      const granted = (await handle.queryPermission?.({ mode: "readwrite" })) === "granted";
      if (!granted) {
        if (!cancelled) setLinkStatus("needs-permission");
        return;
      }
      // The file may have changed elsewhere (another device, a synced folder).
      // Read it before enabling auto-save and, if it differs from what we have
      // in memory, let the user choose — never silently overwrite newer disk
      // content. (Auto-save stays off until this resolves, so no write races it.)
      try {
        const diskText = await (await handle.getFile()).text();
        if (cancelled) return;
        if (diskText !== serializeProject(projectRef.current)) {
          const useDisk = window.confirm(
            `"${handle.name}" was changed outside this browser.\n\n` +
              `OK — load the version on disk (discard local changes)\n` +
              `Cancel — keep your local version (overwrites the file)`,
          );
          if (useDisk) {
            setProject(parseProjectFile(diskText));
            lastWrittenTextRef.current = diskText;
          }
        } else {
          lastWrittenTextRef.current = diskText; // in sync — skip a redundant write
        }
      } catch {
        /* couldn't read — link anyway; the first write will surface any error */
      }
      if (!cancelled) setLinkStatus("linked");
    });
    return () => {
      cancelled = true;
    };
  }, [fsSupported]);

  // Debounced write to the linked disk file when the project changes.
  useEffect(() => {
    if (linkStatus !== "linked" || !fileHandleRef.current) return;
    const text = serializeProject(project);
    if (text === lastWrittenTextRef.current) return; // nothing new to persist
    const timer = setTimeout(() => queueFileWrite(text), 1200);
    return () => clearTimeout(timer);
  }, [project, linkStatus, queueFileWrite]);

  // Restore a mapped output directory on mount (same permission caveat as the
  // linked file: not persisted across loads, so surface "Reconnect" instead).
  useEffect(() => {
    if (!dirSupported) return;
    let cancelled = false;
    loadDirHandle().then(async (handle) => {
      if (cancelled || !handle) return;
      dirHandleRef.current = handle;
      syncedPathsRef.current = loadSyncedPaths();
      setDirName(handle.name);
      const granted = (await handle.queryPermission?.({ mode: "readwrite" })) === "granted";
      setDirStatus(granted ? "linked" : "needs-permission");
    });
    return () => {
      cancelled = true;
    };
  }, [dirSupported]);

  // Compile every file and write it into the mapped directory, recreating any
  // project subfolders. Files that fail to encode are skipped, not aborted, so
  // one bad file doesn't block the rest. Output orphaned by a move/rename/delete
  // is pruned afterwards — but only paths we wrote (see syncedPathsRef).
  const syncToDir = useCallback(
    async (dir: FileSystemDirectoryHandle) => {
      const plan = planExport(project.files, format);
      const byId = new Map(project.files.map((f) => [f.id, f]));
      let ok = 0;
      const errors: string[] = [];
      for (const entry of plan) {
        const file = byId.get(entry.id)!;
        let bytes: Uint8Array;
        try {
          bytes = buildEact(file.title, file.content, { literalSuper: compatibility });
        } catch {
          errors.push(file.title.trim() || "Untitled");
          continue;
        }
        await writeFileInDir(dir, entry.path, bytes);
        ok++;
      }
      // Delete files we wrote before but no longer produce (moved/renamed/deleted).
      const current = new Set(plan.map((e) => e.path));
      const orphans = syncedPathsRef.current.filter((p) => !current.has(p));
      let removed = 0;
      for (const path of orphans) {
        await removeFileInDir(dir, path);
        removed++;
      }
      syncedPathsRef.current = [...current];
      persistSyncedPaths(syncedPathsRef.current);
      return { ok, errors, removed };
    },
    [project.files, format, compatibility],
  );

  // Keep a stable handle to the latest syncToDir so the queue always runs the
  // newest closure (current project) without re-creating the queue callback.
  const syncToDirRef = useRef(syncToDir);
  useEffect(() => {
    syncToDirRef.current = syncToDir;
  }, [syncToDir]);

  // Latest-only folder sync: coalesces overlapping triggers and re-runs once
  // more if another change arrived mid-sync, so the folder reflects the newest
  // state and concurrent runs can't clobber syncedPathsRef.
  const queueDirSync = useCallback(() => {
    const q = dirQueueRef.current;
    q.pending = true;
    if (q.running) return;
    q.running = true;
    (async () => {
      try {
        while (q.pending) {
          q.pending = false;
          const dir = dirHandleRef.current;
          if (!dir) break;
          const { ok, errors, removed } = await syncToDirRef.current(dir);
          setStatus(syncMessage(dir.name, ok, removed, errors));
        }
      } catch {
        q.pending = false;
        setDirStatus("needs-permission");
        const name = dirHandleRef.current?.name ?? "the folder";
        setStatus(`Sync to ${name} failed — reconnect to resume`);
      } finally {
        q.running = false;
      }
    })();
  }, []);

  // Debounced re-sync of the compiled files when the project changes.
  useEffect(() => {
    if (dirStatus !== "linked" || !dirHandleRef.current) return;
    const timer = setTimeout(() => queueDirSync(), 1200);
    return () => clearTimeout(timer);
  }, [project, dirStatus, queueDirSync]);

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
    [content, setContent],
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

  const handleExportAll = () => {
    try {
      const plan = planExport(project.files, format);
      const zipInput: Record<string, Uint8Array> = {};
      let total = 0;
      for (const entry of plan) {
        const file = project.files.find((f) => f.id === entry.id)!;
        try {
          const bytes = buildEact(file.title, file.content, {
            literalSuper: compatibility,
          });
          zipInput[entry.path] = bytes;
          total += bytes.length;
        } catch (err) {
          throw new Error(
            `"${file.title.trim() || "Untitled"}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      const zipped = zipSync(zipInput);
      downloadBlob(
        "eactivities.zip",
        zipped.slice().buffer,
        "application/zip",
      );
      const renamed = plan.filter((e) => e.renamed).length;
      setStatus(
        `Exported ${plan.length} file(s) · ${total} bytes` +
          (renamed ? ` · ${renamed} renamed to avoid name clashes` : ""),
      );
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
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

  // Link the project to a file on disk and auto-save there from now on.
  const handleLinkSave = async () => {
    try {
      const handle = await pickSaveFile(`${safeName(title, "project")}.eam.json`);
      if (!handle) return; // cancelled
      const text = serializeProject(project);
      await writeFile(handle, text);
      lastWrittenTextRef.current = text;
      await saveHandle(handle);
      fileHandleRef.current = handle;
      setLinkedName(handle.name);
      setLinkStatus("linked");
      setStatus(`Auto-saving to ${handle.name}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenFromDisk = async () => {
    try {
      const opened = await pickOpenFile();
      if (!opened) return; // cancelled
      setProject(parseProjectFile(opened.text));
      lastWrittenTextRef.current = opened.text; // disk already holds this
      await saveHandle(opened.handle);
      fileHandleRef.current = opened.handle;
      setLinkedName(opened.handle.name);
      setLinkStatus("linked");
      setStatus(`Opened ${opened.handle.name} — auto-saving`);
    } catch {
      setStatus("Could not open that file (expected a .eam.json project)");
    }
  };

  const handleReconnect = async () => {
    const handle = fileHandleRef.current;
    if (!handle) return;
    try {
      if (!(await ensureRW(handle))) {
        setStatus(`Permission denied for ${handle.name} — reconnect to resume`);
        return;
      }
      const text = serializeProject(project);
      await writeFile(handle, text);
      lastWrittenTextRef.current = text;
      setLinkStatus("linked");
      setStatus(`Auto-saving to ${handle.name}`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUnlink = async () => {
    await clearHandle();
    fileHandleRef.current = null;
    setLinkedName(null);
    setLinkStatus("none");
    setStatus("Unlinked — still auto-saving in this browser");
  };

  // Map an output directory and write the compiled files into it from now on.
  const handleMapFolder = async () => {
    try {
      const dir = await pickDirectory();
      if (!dir) return; // cancelled
      // Fresh mapping: don't treat any pre-existing files as ours to prune.
      syncedPathsRef.current = [];
      persistSyncedPaths([]);
      dirHandleRef.current = dir;
      setDirName(dir.name);
      setDirStatus("linked");
      await saveDirHandle(dir);
      const { ok, errors, removed } = await syncToDir(dir);
      setStatus(syncMessage(dir.name, ok, removed, errors));
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleReconnectDir = async () => {
    const dir = dirHandleRef.current;
    if (!dir) return;
    try {
      if (!(await ensureRW(dir))) {
        setStatus(`Permission denied for ${dir.name} — reconnect to resume`);
        return;
      }
      setDirStatus("linked");
      const { ok, errors, removed } = await syncToDir(dir);
      setStatus(syncMessage(dir.name, ok, removed, errors));
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUnmapFolder = async () => {
    await clearDirHandle();
    syncedPathsRef.current = [];
    persistSyncedPaths([]);
    dirHandleRef.current = null;
    setDirName(null);
    setDirStatus("none");
    setStatus("Stopped syncing to folder");
  };

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
          fsSupported={fsSupported}
          linkStatus={linkStatus}
          linkedName={linkedName}
          onLinkSave={handleLinkSave}
          onOpenDisk={handleOpenFromDisk}
          onReconnect={handleReconnect}
          onUnlink={handleUnlink}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
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
              onClick={() =>
                setActiveTab((cur) => (cur === p.id ? null : p.id))
              }
              title={
                activeTab === p.id ? `Hide ${p.label}` : `Show ${p.label}`
              }
              aria-expanded={activeTab === p.id}
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
        {activeTab != null && (
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
        )}
      </section>

      {/* Editor (per-file) */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Editor — <span className="font-mono">{title.trim() || "Untitled"}</span>
            <span className="font-normal text-black/40 dark:text-white/40">
              {" "}· one line per row (double-click the file name to rename)
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

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Preview</span>
          <div className="flex h-56 flex-col overflow-hidden rounded-xl border border-black/15 dark:border-white/15">
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
          onClick={handleExportAll}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-700"
        >
          Export all (.zip)
        </button>
        <button
          type="button"
          onClick={handleConvert}
          disabled={analysis.size == null}
          className="rounded-lg border border-emerald-600/40 px-4 py-2.5 font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
        >
          Download this file (.{format})
        </button>
        {dirSupported && dirStatus === "none" && (
          <button
            type="button"
            onClick={handleMapFolder}
            title="Pick a folder and write the compiled files there, re-syncing on change"
            className="rounded-lg border border-emerald-600/40 px-4 py-2.5 font-medium text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
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
            <span className="max-w-[12rem] truncate">Syncing to {dirName}</span>
            <button
              type="button"
              onClick={handleUnmapFolder}
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
            onClick={handleReconnectDir}
            title="Re-grant access to resume syncing compiled files"
            className="rounded-lg border border-amber-500/50 px-4 py-2.5 font-medium text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
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
