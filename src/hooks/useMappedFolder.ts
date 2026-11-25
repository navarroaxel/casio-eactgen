import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compileFile } from "@/lib/compile";
import { errorMessage } from "@/lib/errorMessage";
import {
  clearDirHandle,
  ensureRW,
  isDirPickerSupported,
  loadDirHandle,
  pickDirectory,
  removeFileInDir,
  saveDirHandle,
  writeFileInDir,
} from "@/lib/fsAccess";
import { planExport, type Project } from "@/lib/project";
import type { LinkStatus } from "@/components/file-navigator/types";

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

function syncMessage(
  dir: string,
  ok: number,
  removed: number,
  errors: string[],
) {
  return (
    `Synced ${ok} file(s) to ${dir}` +
    (removed ? ` · ${removed} orphan(s) removed` : "") +
    (errors.length ? ` · ${errors.length} skipped (encode error)` : "")
  );
}

interface Options {
  project: Project;
  setStatus: (message: string) => void;
}

/**
 * Optional mapping to an output directory on disk: the compiled .g2e/.g1e files
 * (one per project file, subfolders recreated) are written there and re-synced
 * on change — point it at a Drive folder to publish straight to it.
 */
export function useMappedFolder({ project, setStatus }: Options) {
  const dirSupported = useMemo(() => isDirPickerSupported(), []);
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [dirStatus, setDirStatus] = useState<LinkStatus>("none");
  const [dirName, setDirName] = useState<string | null>(null);

  // Paths we last wrote into the mapped folder. On each sync we delete the ones
  // no longer produced (moved/renamed/deleted files) so they aren't orphaned —
  // but only files *we* wrote, never pre-existing files in the chosen folder.
  const syncedPathsRef = useRef<string[]>([]);

  const queueRef = useRef<{ running: boolean; pending: boolean }>({
    running: false,
    pending: false,
  });

  const { format, compatibility } = project;

  // Restore a mapped output directory on mount (permission isn't persisted
  // across loads, so surface "Reconnect" instead of prompting).
  useEffect(() => {
    if (!dirSupported) return;
    let cancelled = false;
    loadDirHandle().then(async (handle) => {
      if (cancelled || !handle) return;
      handleRef.current = handle;
      syncedPathsRef.current = loadSyncedPaths();
      setDirName(handle.name);
      const granted =
        (await handle.queryPermission?.({ mode: "readwrite" })) === "granted";
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
          bytes = compileFile(file, { format, compatibility });
        } catch {
          errors.push(file.title.trim() || "Untitled");
          continue;
        }
        await writeFileInDir(dir, entry.path, bytes);
        ok++;
      }
      // Delete files we wrote before but no longer produce.
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

  // Stable handle to the latest syncToDir so the queue always runs the newest
  // closure (current project) without re-creating the queue callback.
  const syncToDirRef = useRef(syncToDir);
  useEffect(() => {
    syncToDirRef.current = syncToDir;
  }, [syncToDir]);

  // Latest-only folder sync: coalesces overlapping triggers and re-runs once
  // more if another change arrived mid-sync, so the folder reflects the newest
  // state and concurrent runs can't clobber syncedPathsRef.
  const queueSync = useCallback(() => {
    const q = queueRef.current;
    q.pending = true;
    if (q.running) return;
    q.running = true;
    (async () => {
      try {
        while (q.pending) {
          q.pending = false;
          const dir = handleRef.current;
          if (!dir) break;
          const { ok, errors, removed } = await syncToDirRef.current(dir);
          setStatus(syncMessage(dir.name, ok, removed, errors));
        }
      } catch {
        q.pending = false;
        setDirStatus("needs-permission");
        const name = handleRef.current?.name ?? "the folder";
        setStatus(`Sync to ${name} failed — reconnect to resume`);
      } finally {
        q.running = false;
      }
    })();
  }, [setStatus]);

  // Debounced re-sync of the compiled files when the project changes.
  useEffect(() => {
    if (dirStatus !== "linked" || !handleRef.current) return;
    const timer = setTimeout(() => queueSync(), 1200);
    return () => clearTimeout(timer);
  }, [project, dirStatus, queueSync]);

  // Map an output directory and write the compiled files into it from now on.
  const mapFolder = async () => {
    try {
      const dir = await pickDirectory();
      if (!dir) return; // cancelled
      // Fresh mapping: don't treat any pre-existing files as ours to prune.
      syncedPathsRef.current = [];
      persistSyncedPaths([]);
      handleRef.current = dir;
      setDirName(dir.name);
      setDirStatus("linked");
      await saveDirHandle(dir);
      const { ok, errors, removed } = await syncToDir(dir);
      setStatus(syncMessage(dir.name, ok, removed, errors));
    } catch (err) {
      setStatus(`Error: ${errorMessage(err)}`);
    }
  };

  const reconnect = async () => {
    const dir = handleRef.current;
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
      setStatus(`Error: ${errorMessage(err)}`);
    }
  };

  const unmap = async () => {
    await clearDirHandle();
    syncedPathsRef.current = [];
    persistSyncedPaths([]);
    handleRef.current = null;
    setDirName(null);
    setDirStatus("none");
    setStatus("Stopped syncing to folder");
  };

  return { dirSupported, dirStatus, dirName, mapFolder, reconnect, unmap };
}
