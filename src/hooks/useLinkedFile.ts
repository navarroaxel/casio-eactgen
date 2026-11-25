import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  clearHandle,
  ensureRW,
  isFsAccessSupported,
  loadHandle,
  pickOpenFile,
  pickSaveFile,
  saveHandle,
  writeFile,
} from "@/lib/fsAccess";
import { errorMessage } from "@/lib/errorMessage";
import {
  parseProjectFile,
  safeName,
  serializeProject,
  type Project,
} from "@/lib/project";
import type { LinkStatus } from "@/components/file-navigator/types";

interface Options {
  project: Project;
  setProject: Dispatch<SetStateAction<Project>>;
  setStatus: (message: string) => void;
  /** Name used to suggest the file name in the save picker. */
  suggestedName: string;
}

/**
 * Optional link to an .eam.json on disk (File System Access API). When linked
 * and permitted, the project auto-saves there in addition to localStorage —
 * point it at a Drive/Dropbox folder to sync. The handle lives in IndexedDB.
 */
export function useLinkedFile({
  project,
  setProject,
  setStatus,
  suggestedName,
}: Options) {
  const fsSupported = useMemo(() => isFsAccessSupported(), []);
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("none");
  const [linkedName, setLinkedName] = useState<string | null>(null);

  // Serialized text we last wrote to the linked file, to skip redundant writes
  // and to reconcile disk-vs-memory on mount (see the restore effect).
  const lastWrittenTextRef = useRef<string | null>(null);

  // Latest project, readable from the mount-only restore effect without making
  // it a dependency (it must not re-run on every edit).
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Latest-only write queue: a write already in flight finishes, then the most
  // recent pending payload runs — never an older one after a newer.
  const queueRef = useRef<{ running: boolean; pending: string | null }>({
    running: false,
    pending: null,
  });

  // Serialize the project to the linked file, newest-payload-wins. Drops stale
  // in-flight writes so an older debounced save can't land after a newer one.
  const queueWrite = useCallback(
    (text: string) => {
      const q = queueRef.current;
      q.pending = text;
      if (q.running) return;
      q.running = true;
      (async () => {
        try {
          while (q.pending !== null) {
            const next = q.pending;
            q.pending = null;
            const handle = handleRef.current;
            if (!handle) break;
            await writeFile(handle, next);
            lastWrittenTextRef.current = next;
          }
        } catch {
          // Lost access (file moved, permission revoked) — ask to reconnect.
          q.pending = null;
          setLinkStatus("needs-permission");
          const name = handleRef.current?.name ?? "the linked file";
          setStatus(`Auto-save to ${name} failed — reconnect to resume`);
        } finally {
          q.running = false;
        }
      })();
    },
    [setStatus],
  );

  // Restore a previously linked file on mount. File System Access permission is
  // not persisted across loads, so unless the origin still holds it we surface a
  // "Reconnect" affordance rather than prompting without a user gesture. (IDB is
  // async so this must live in an effect — unrelated to the localStorage rule.)
  useEffect(() => {
    if (!fsSupported) return;
    let cancelled = false;
    loadHandle().then(async (handle) => {
      if (cancelled || !handle) return;
      handleRef.current = handle;
      setLinkedName(handle.name);
      const granted =
        (await handle.queryPermission?.({ mode: "readwrite" })) === "granted";
      if (!granted) {
        if (!cancelled) setLinkStatus("needs-permission");
        return;
      }
      // The file may have changed elsewhere (another device, a synced folder).
      // Read it before enabling auto-save and, if it differs from what we have
      // in memory, let the user choose — never silently overwrite newer disk
      // content. (Auto-save stays off until this resolves, so no write races it.)
      // A native confirm is deliberate here: this is a blocking either/or
      // decision raised from an async mount effect.
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
  }, [fsSupported, setProject]);

  // Debounced write to the linked disk file when the project changes.
  useEffect(() => {
    if (linkStatus !== "linked" || !handleRef.current) return;
    const text = serializeProject(project);
    if (text === lastWrittenTextRef.current) return; // nothing new to persist
    const timer = setTimeout(() => queueWrite(text), 1200);
    return () => clearTimeout(timer);
  }, [project, linkStatus, queueWrite]);

  // Link the project to a file on disk and auto-save there from now on.
  const linkSave = async () => {
    try {
      const handle = await pickSaveFile(
        `${safeName(suggestedName, "project")}.eam.json`,
      );
      if (!handle) return; // cancelled
      const text = serializeProject(project);
      await writeFile(handle, text);
      lastWrittenTextRef.current = text;
      await saveHandle(handle);
      handleRef.current = handle;
      setLinkedName(handle.name);
      setLinkStatus("linked");
      setStatus(`Auto-saving to ${handle.name}`);
    } catch (err) {
      setStatus(`Error: ${errorMessage(err)}`);
    }
  };

  const openFromDisk = async () => {
    try {
      const opened = await pickOpenFile();
      if (!opened) return; // cancelled
      setProject(parseProjectFile(opened.text));
      lastWrittenTextRef.current = opened.text; // disk already holds this
      await saveHandle(opened.handle);
      handleRef.current = opened.handle;
      setLinkedName(opened.handle.name);
      setLinkStatus("linked");
      setStatus(`Opened ${opened.handle.name} — auto-saving`);
    } catch {
      setStatus("Could not open that file (expected a .eam.json project)");
    }
  };

  const reconnect = async () => {
    const handle = handleRef.current;
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
      setStatus(`Error: ${errorMessage(err)}`);
    }
  };

  const unlink = async () => {
    await clearHandle();
    handleRef.current = null;
    setLinkedName(null);
    setLinkStatus("none");
    setStatus("Unlinked — still auto-saving in this browser");
  };

  return {
    fsSupported,
    linkStatus,
    linkedName,
    linkSave,
    openFromDisk,
    reconnect,
    unlink,
  };
}
