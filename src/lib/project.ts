// Project model: a project is a collection of eActivity files organised into
// one level of folders. Format and compatibility are global to the project.
//
// The encoder (src/lib/casio) still works one file at a time; this module only
// describes how files are grouped, persisted, and migrated from the old
// single-file shape. See AGENTS.md for the byte-format contract.
import type { EactFormat } from "@/lib/casio";

/** One eActivity = one file the calculator opens. */
export interface EactFile {
  id: string;
  /** One-level grouping. null = project root. */
  folder: string | null;
  /** ≤8-char on-calculator name / banner (was the global project title). */
  title: string;
  /** Markup source — the encoder's input. */
  content: string;
}

export interface ProjectUi {
  /** Currently edited file. */
  activeId: string | null;
  /** Whether the (collapsible) file navigator is expanded. */
  navOpen: boolean;
}

export interface Project {
  v: 1;
  format: EactFormat; // global
  compatibility: boolean; // global
  files: EactFile[];
  /** Declared folders — explicit so empty/renamed folders survive. */
  folders: string[];
  ui: ProjectUi;
}

// Reuses the original single-file autosave key: the legacy (unversioned)
// payload at this key is upgraded in place by migrate().
export const STORAGE_KEY = "eactmaker.project.v1";

let idCounter = 0;
export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `f${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

export function newFile(partial: Partial<Omit<EactFile, "id">> = {}): EactFile {
  return { id: newId(), folder: null, title: "", content: "", ...partial };
}

export function emptyProject(): Project {
  const f = newFile();
  return {
    v: 1,
    format: "g2e",
    compatibility: false,
    files: [f],
    folders: [],
    ui: { activeId: f.id, navOpen: true },
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function coerceV1(obj: Record<string, unknown>): Project {
  const rawFiles = Array.isArray(obj.files) ? obj.files : [];
  const files: EactFile[] = rawFiles.filter(isObject).map((f) => ({
    id: typeof f.id === "string" && f.id ? f.id : newId(),
    folder: typeof f.folder === "string" ? f.folder : null,
    title: typeof f.title === "string" ? f.title : "",
    content: typeof f.content === "string" ? f.content : "",
  }));
  if (files.length === 0) files.push(newFile());

  // Folders = declared ∪ folders referenced by files (so nothing is orphaned).
  const referenced = files
    .map((f) => f.folder)
    .filter((x): x is string => !!x);
  const declared = Array.isArray(obj.folders)
    ? obj.folders.filter((x): x is string => typeof x === "string")
    : [];
  const folders = Array.from(new Set([...declared, ...referenced]));

  const ui = isObject(obj.ui) ? obj.ui : {};
  let activeId = typeof ui.activeId === "string" ? ui.activeId : null;
  if (!activeId || !files.some((f) => f.id === activeId)) activeId = files[0].id;
  const navOpen = ui.navOpen === undefined ? true : Boolean(ui.navOpen);

  return {
    v: 1,
    format: obj.format === "g1e" ? "g1e" : "g2e",
    compatibility: Boolean(obj.compatibility),
    files,
    folders,
    ui: { activeId, navOpen },
  };
}

/** Normalise any persisted/loaded blob into a valid v1 Project. */
export function migrate(data: unknown): Project {
  if (!isObject(data)) return emptyProject();

  if (data.v === 1 && Array.isArray(data.files)) return coerceV1(data);

  // Legacy single-file payload (no `v`): { title, format, compatibility,
  // content } — wrap into one file.
  if ("content" in data || "title" in data) {
    const file = newFile({
      title: typeof data.title === "string" ? data.title : "",
      content: typeof data.content === "string" ? data.content : "",
    });
    return {
      v: 1,
      format: data.format === "g1e" ? "g1e" : "g2e",
      compatibility: Boolean(data.compatibility),
      files: [file],
      folders: [],
      ui: { activeId: file.id, navOpen: true },
    };
  }

  return emptyProject();
}

/** Load the autosaved project from localStorage (client-only). */
export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProject();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyProject();
  }
}

/** Parse a loaded .eam.json file (any version) into a v1 Project. */
export function parseProjectFile(text: string): Project {
  return migrate(JSON.parse(text));
}

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}

/** Sanitise a string into a filesystem-safe name, or fall back if empty. */
export const safeName = (s: string, fallback: string) =>
  (s.trim() || fallback).replace(/[^\w.-]+/g, "_");

export interface ExportEntry {
  id: string;
  /** zip path: `folder/name.ext` or `name.ext` at the root. */
  path: string;
  /** true if the base name was changed to dodge a same-folder collision. */
  renamed: boolean;
}

/**
 * Resolve each file to a zip path, deduplicating names *within the same folder*
 * (case-insensitively, since the calculator's storage is case-folding). Files in
 * different folders never collide.
 */
export function planExport(
  files: EactFile[],
  format: EactFormat,
): ExportEntry[] {
  const usedByDir = new Map<string, Set<string>>();
  return files.map((f) => {
    const dir = f.folder ? safeName(f.folder, "folder") : "";
    const base = safeName(f.title, "untitled");
    const used = usedByDir.get(dir) ?? new Set<string>();
    usedByDir.set(dir, used);
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${base}-${n++}`;
    used.add(name.toLowerCase());
    const path = dir ? `${dir}/${name}.${format}` : `${name}.${format}`;
    return { id: f.id, path, renamed: name !== base };
  });
}
