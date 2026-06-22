// File System Access API + handle persistence.
//
// Lets a project be linked to a real `.eam.json` file on disk and auto-saved
// there as the user works. If that file lives in a Google Drive / Dropbox /
// OneDrive *synced* folder, the project syncs across devices — no OAuth, no
// backend (see AGENTS.md: everything stays client-side).
//
// The handle is transient *device* state: it is structured-cloneable but not
// JSON-serialisable, so it lives in IndexedDB and is NEVER put into the Project
// JSON (which must stay portable). Chromium-only; callers fall back to the
// download/upload path when isFsAccessSupported() is false.

// These pickers and the permission methods are not yet in TS's DOM lib.
interface FilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerType[];
}
interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerType[];
}
type FsPermissionDescriptor = { mode?: "read" | "readwrite" };

declare global {
  interface Window {
    showSaveFilePicker?: (
      opts?: SaveFilePickerOptions,
    ) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (
      opts?: OpenFilePickerOptions,
    ) => Promise<FileSystemFileHandle[]>;
    showDirectoryPicker?: (opts?: {
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission?: (
      desc?: FsPermissionDescriptor,
    ) => Promise<PermissionState>;
    requestPermission?: (
      desc?: FsPermissionDescriptor,
    ) => Promise<PermissionState>;
  }
  // Async iteration of directory entries (lib.dom.asynciterable, not in our libs).
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}

const EAM_TYPES: FilePickerType[] = [
  { description: "Eact Maker project", accept: { "application/json": [".eam.json", ".json"] } },
];

/** True when the browser supports linking a project to a file on disk. */
export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** Prompt for a save location. Returns null if the user cancels the dialog. */
export async function pickSaveFile(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker!({ suggestedName, types: EAM_TYPES });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Prompt to open a project file. Returns the handle + its text, or null on cancel. */
export async function pickOpenFile(): Promise<{
  handle: FileSystemFileHandle;
  text: string;
} | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({
      multiple: false,
      types: EAM_TYPES,
    });
    const text = await (await handle.getFile()).text();
    return { handle, text };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Overwrite the handle's file with `text`. */
export async function writeFile(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** True when the browser can map the project to a directory on disk. */
export function isDirPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Prompt for a directory to sync into. Returns null if the user cancels. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker!({ mode: "readwrite" });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/**
 * Write `data` to `path` (e.g. `Physics/NEWTON.g2e`) inside `dir`, creating any
 * intermediate subdirectories. Overwrites an existing file at that path.
 */
export async function writeFileInDir(
  dir: FileSystemDirectoryHandle,
  path: string,
  data: Uint8Array,
): Promise<void> {
  const parts = path.split("/");
  const name = parts.pop()!;
  let cur = dir;
  for (const seg of parts) {
    cur = await cur.getDirectoryHandle(seg, { create: true });
  }
  const fileHandle = await cur.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  // Copy into an ArrayBuffer-backed view so the type matches FileSystemWriteChunkType.
  await writable.write(new Uint8Array(data));
  await writable.close();
}

async function isEmpty(dir: FileSystemDirectoryHandle): Promise<boolean> {
  return (await dir.entries().next()).done === true;
}

/**
 * Delete the file at `path` inside `dir`, then remove any of its parent
 * subdirectories that the deletion left empty (so a moved-out file doesn't
 * leave an empty folder behind). No-op if the file is already gone.
 */
export async function removeFileInDir(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const parts = path.split("/");
  const name = parts.pop()!;
  const chain: FileSystemDirectoryHandle[] = [dir];
  try {
    let cur = dir;
    for (const seg of parts) {
      cur = await cur.getDirectoryHandle(seg);
      chain.push(cur);
    }
    await cur.removeEntry(name);
  } catch (e) {
    // Already gone — nothing to clean up.
    if (e instanceof DOMException && e.name === "NotFoundError") return;
    // Permission revoked / IO error: let the caller surface it (reconnect) and
    // keep the path tracked so cleanup is retried, rather than faking success.
    throw e;
  }
  // Climb up removing now-empty subfolders (stop at the first non-empty one).
  for (let i = chain.length - 1; i >= 1; i--) {
    if (!(await isEmpty(chain[i]))) break;
    await chain[i - 1].removeEntry(parts[i - 1]);
  }
}

/**
 * Ensure we hold readwrite permission, prompting if needed. File System Access
 * permission is not persisted across page loads, so a stored handle must be
 * re-granted via a user gesture before it can be written.
 */
export async function ensureRW(handle: FileSystemHandle): Promise<boolean> {
  const desc: FsPermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission?.(desc)) === "granted") return true;
  return (await handle.requestPermission?.(desc)) === "granted";
}

// --- IndexedDB handle store (DB `eactmaker`, store `handles`, key `project`) ---

const DB_NAME = "eactmaker";
const STORE = "handles";
/** Linked `.eam.json` file handle. */
const FILE_KEY = "project";
/** Mapped output directory handle. */
const DIR_KEY = "projectDir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let settled = false;
        const close = () => {
          try {
            db.close();
          } catch {
            /* already closing */
          }
        };
        const fail = (err: unknown) => {
          if (settled) return;
          settled = true;
          close();
          reject(err ?? new DOMException("IndexedDB transaction failed", "AbortError"));
        };
        try {
          const transaction = db.transaction(STORE, mode);
          const req = run(transaction.objectStore(STORE));
          // Resolve only once the write is durable (commit), not on request
          // success — a transaction can still abort after a successful request.
          transaction.oncomplete = () => {
            if (settled) return;
            settled = true;
            close();
            resolve(req.result);
          };
          req.onerror = () => fail(req.error);
          transaction.onerror = () => fail(transaction.error);
          transaction.onabort = () => fail(transaction.error);
        } catch (e) {
          fail(e); // e.g. the object store is missing
        }
      }),
  );
}

function putHandle(key: string, handle: FileSystemHandle): Promise<void> {
  return tx<IDBValidKey>("readwrite", (s) => s.put(handle, key)).then(() => {});
}

async function getHandle<T extends FileSystemHandle>(key: string): Promise<T | null> {
  try {
    return (await tx<T | undefined>("readonly", (s) => s.get(key))) ?? null;
  } catch {
    return null;
  }
}

function delHandle(key: string): Promise<void> {
  return tx<undefined>("readwrite", (s) => s.delete(key)).then(() => {});
}

/** Remember the linked file handle so it survives reloads. */
export const saveHandle = (handle: FileSystemFileHandle) => putHandle(FILE_KEY, handle);
/** Read the stored file handle, or null if none / IndexedDB is unavailable. */
export const loadHandle = () => getHandle<FileSystemFileHandle>(FILE_KEY);
/** Forget the linked file handle (stops auto-saving to disk). */
export const clearHandle = () => delHandle(FILE_KEY);

/** Remember the mapped output directory so it survives reloads. */
export const saveDirHandle = (handle: FileSystemDirectoryHandle) => putHandle(DIR_KEY, handle);
/** Read the stored directory handle, or null if none / IndexedDB is unavailable. */
export const loadDirHandle = () => getHandle<FileSystemDirectoryHandle>(DIR_KEY);
/** Forget the mapped directory (stops syncing compiled files). */
export const clearDirHandle = () => delHandle(DIR_KEY);
