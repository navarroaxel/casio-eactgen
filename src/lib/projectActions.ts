// Pure Project → Project transitions used by the editor. Keeping them out of the
// component makes the folder/file rules (collision handling, last-file guard,
// active-file bookkeeping) unit-testable.
import type { EactFormat } from "@/lib/casio";
import { newFile, type EactFile, type Project } from "@/lib/project";

export const setFormat = (p: Project, format: EactFormat): Project => ({
  ...p,
  format,
});

export const setCompatibility = (
  p: Project,
  compatibility: boolean,
): Project => ({ ...p, compatibility });

export const updateFile = (
  p: Project,
  id: string,
  patch: Partial<EactFile>,
): Project => ({
  ...p,
  files: p.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
});

export const selectFile = (p: Project, id: string): Project => ({
  ...p,
  ui: { ...p.ui, activeId: id },
});

export const toggleNav = (p: Project): Project => ({
  ...p,
  ui: { ...p.ui, navOpen: !p.ui.navOpen },
});

export function addFile(p: Project, folder: string | null = null): Project {
  const f = newFile({ folder });
  return { ...p, files: [...p.files, f], ui: { ...p.ui, activeId: f.id } };
}

/** Append already-built files (import) and focus the last one. */
export function appendFiles(p: Project, files: EactFile[]): Project {
  if (files.length === 0) return p;
  return {
    ...p,
    files: [...p.files, ...files],
    ui: { ...p.ui, activeId: files[files.length - 1].id },
  };
}

/** Never leaves the project without a file. */
export function deleteFile(p: Project, id: string): Project {
  let files = p.files.filter((f) => f.id !== id);
  if (files.length === 0) files = [newFile()];
  const activeId = p.ui.activeId === id ? files[0].id : p.ui.activeId;
  return { ...p, files, ui: { ...p.ui, activeId } };
}

export const moveFile = (
  p: Project,
  id: string,
  folder: string | null,
): Project => updateFile(p, id, { folder });

/** No-op for a duplicate name. */
export const addFolder = (p: Project, name: string): Project =>
  p.folders.includes(name) ? p : { ...p, folders: [...p.folders, name] };

/** No-op if `next` already exists (avoids silently merging two folders). */
export function renameFolder(p: Project, name: string, next: string): Project {
  if (next === name || p.folders.includes(next)) return p;
  return {
    ...p,
    folders: p.folders.map((fl) => (fl === name ? next : fl)),
    files: p.files.map((f) => (f.folder === name ? { ...f, folder: next } : f)),
  };
}

/** Files in the deleted folder move to the project root. */
export const deleteFolder = (p: Project, name: string): Project => ({
  ...p,
  folders: p.folders.filter((fl) => fl !== name),
  files: p.files.map((f) => (f.folder === name ? { ...f, folder: null } : f)),
});
