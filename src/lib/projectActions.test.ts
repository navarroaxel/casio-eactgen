import { describe, expect, it } from "vitest";
import { emptyProject, newFile, type Project } from "./project";
import {
  addFile,
  addFolder,
  appendFiles,
  deleteFile,
  deleteFolder,
  moveFile,
  renameFolder,
} from "./projectActions";

function withFolders(): Project {
  const a = newFile({ title: "A", folder: "x" });
  const b = newFile({ title: "B", folder: null });
  return {
    ...emptyProject(),
    files: [a, b],
    folders: ["x", "y"],
    ui: { activeId: a.id, navOpen: true },
  };
}

describe("projectActions", () => {
  it("addFile adds to the folder and activates it", () => {
    const p = addFile(withFolders(), "y");
    const added = p.files[p.files.length - 1];
    expect(added.folder).toBe("y");
    expect(p.ui.activeId).toBe(added.id);
  });

  it("deleteFile keeps at least one file and re-targets the active file", () => {
    const only = emptyProject();
    const after = deleteFile(only, only.files[0].id);
    expect(after.files).toHaveLength(1);
    expect(after.files[0].id).not.toBe(only.files[0].id);
    expect(after.ui.activeId).toBe(after.files[0].id);

    const p = withFolders();
    const next = deleteFile(p, p.ui.activeId!);
    expect(next.files).toHaveLength(1);
    expect(next.ui.activeId).toBe(next.files[0].id);
  });

  it("addFolder ignores duplicates", () => {
    const p = withFolders();
    expect(addFolder(p, "x")).toBe(p);
    expect(addFolder(p, "z").folders).toEqual(["x", "y", "z"]);
  });

  it("renameFolder moves its files and refuses to merge into an existing folder", () => {
    const p = withFolders();
    const renamed = renameFolder(p, "x", "z");
    expect(renamed.folders).toEqual(["z", "y"]);
    expect(renamed.files[0].folder).toBe("z");
    expect(renameFolder(p, "x", "y")).toBe(p);
    expect(renameFolder(p, "x", "x")).toBe(p);
  });

  it("deleteFolder moves its files to the root", () => {
    const p = deleteFolder(withFolders(), "x");
    expect(p.folders).toEqual(["y"]);
    expect(p.files[0].folder).toBeNull();
  });

  it("moveFile changes only the target file", () => {
    const p = withFolders();
    const moved = moveFile(p, p.files[1].id, "y");
    expect(moved.files[1].folder).toBe("y");
    expect(moved.files[0].folder).toBe("x");
  });

  it("appendFiles focuses the last appended file and is a no-op when empty", () => {
    const p = withFolders();
    expect(appendFiles(p, [])).toBe(p);
    const extra = [newFile(), newFile()];
    const next = appendFiles(p, extra);
    expect(next.files).toHaveLength(4);
    expect(next.ui.activeId).toBe(extra[1].id);
  });
});
