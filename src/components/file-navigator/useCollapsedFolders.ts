import { useCallback, useState } from "react";

const STORAGE_KEY = "eactmaker.collapsedfolders.v1";

// Per-device UI state (not part of the portable Project JSON). Safe to read in a
// lazy initializer: the whole editor is rendered client-only.
function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function save(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable — state still works for this session */
  }
}

/** Which folders are collapsed, persisted per device. */
export function useCollapsedFolders(folders: string[]) {
  const [collapsed, setCollapsed] = useState<Set<string>>(load);

  const apply = useCallback((next: Set<string>) => {
    setCollapsed(next);
    save(next);
  }, []);

  const toggle = (folder: string) => {
    const next = new Set(collapsed);
    if (!next.delete(folder)) next.add(folder);
    apply(next);
  };

  const allCollapsed =
    folders.length > 0 && folders.every((f) => collapsed.has(f));
  const toggleAll = () => apply(allCollapsed ? new Set() : new Set(folders));

  return {
    isCollapsed: (folder: string) => collapsed.has(folder),
    toggle,
    toggleAll,
    allCollapsed,
  };
}
