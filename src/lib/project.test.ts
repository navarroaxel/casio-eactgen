import { describe, expect, it } from "vitest";
import {
  emptyProject,
  migrate,
  newFile,
  planExport,
  safeName,
  serializeProject,
  type EactFile,
} from "./project";

describe("safeName", () => {
  it("replaces filesystem-unsafe characters", () => {
    expect(safeName("a/b:c*d", "x")).toBe("a_b_c_d");
  });

  it("falls back when blank or whitespace-only", () => {
    expect(safeName("", "fallback")).toBe("fallback");
    expect(safeName("   ", "fallback")).toBe("fallback");
  });

  it("trims surrounding whitespace before sanitising", () => {
    expect(safeName("  name  ", "x")).toBe("name");
  });
});

describe("emptyProject", () => {
  it("starts with exactly one file, selected as active", () => {
    const p = emptyProject();
    expect(p.files).toHaveLength(1);
    expect(p.ui.activeId).toBe(p.files[0].id);
    expect(p.format).toBe("g2e");
  });
});

describe("migrate", () => {
  it("wraps a garbage/empty payload into an empty project", () => {
    expect(migrate(null).files).toHaveLength(1);
    expect(migrate(42).files).toHaveLength(1);
  });

  it("upgrades a legacy single-file payload (no v field)", () => {
    const p = migrate({ title: "OLD", content: "hi", format: "g1e" });
    expect(p.v).toBe(1);
    expect(p.format).toBe("g1e");
    expect(p.files).toHaveLength(1);
    expect(p.files[0]).toMatchObject({ title: "OLD", content: "hi" });
    expect(p.ui.activeId).toBe(p.files[0].id);
  });

  it("passes through a well-formed v1 payload", () => {
    const f = newFile({ title: "T", content: "c" });
    const p = migrate({
      v: 1,
      format: "g3e",
      compatibility: true,
      files: [f],
      folders: [],
      ui: { activeId: f.id, navOpen: false },
    });
    expect(p.format).toBe("g3e");
    expect(p.compatibility).toBe(true);
    expect(p.ui.navOpen).toBe(false);
    expect(p.files[0].id).toBe(f.id);
  });

  it("derives an id for files missing one, and repairs a dangling activeId", () => {
    const p = migrate({
      v: 1,
      files: [{ title: "A", content: "" }],
      ui: { activeId: "does-not-exist" },
    });
    expect(p.files[0].id).toBeTruthy();
    expect(p.ui.activeId).toBe(p.files[0].id);
  });

  it("unions declared folders with folders referenced by files", () => {
    const p = migrate({
      v: 1,
      folders: ["Declared"],
      files: [{ folder: "Referenced", title: "A", content: "" }],
    });
    expect(new Set(p.folders)).toEqual(new Set(["Declared", "Referenced"]));
  });

  it("falls back to an empty project when files is empty", () => {
    const p = migrate({ v: 1, files: [] });
    expect(p.files).toHaveLength(1);
  });
});

describe("serializeProject", () => {
  it("round-trips through migrate/JSON.parse", () => {
    const p = emptyProject();
    const round = migrate(JSON.parse(serializeProject(p)));
    expect(round.files[0].id).toBe(p.files[0].id);
    expect(round.format).toBe(p.format);
  });
});

describe("planExport", () => {
  const file = (partial: Partial<EactFile>): EactFile => ({
    id: partial.id ?? Math.random().toString(36),
    folder: partial.folder ?? null,
    title: partial.title ?? "",
    content: partial.content ?? "",
  });

  it("places root files at the top level", () => {
    const plan = planExport([file({ title: "Foo" })], "g2e");
    expect(plan[0].path).toBe("Foo.g2e");
    expect(plan[0].renamed).toBe(false);
  });

  it("nests files under their sanitised folder name", () => {
    const plan = planExport([file({ folder: "My Folder", title: "Foo" })], "g1e");
    expect(plan[0].path).toBe("My_Folder/Foo.g1e");
  });

  it("dedupes same-folder, case-insensitive name collisions", () => {
    const plan = planExport(
      [file({ title: "Foo" }), file({ title: "foo" }), file({ title: "FOO" })],
      "g2e",
    );
    expect(plan.map((e) => e.path)).toEqual(["Foo.g2e", "foo-2.g2e", "FOO-3.g2e"]);
    expect(plan[0].renamed).toBe(false);
    expect(plan[1].renamed).toBe(true);
    expect(plan[2].renamed).toBe(true);
  });

  it("does not let files in different folders collide", () => {
    const plan = planExport(
      [file({ folder: "A", title: "Foo" }), file({ folder: "B", title: "Foo" })],
      "g2e",
    );
    expect(plan.map((e) => e.path)).toEqual(["A/Foo.g2e", "B/Foo.g2e"]);
  });

  it("falls back to 'untitled' for a blank title", () => {
    const plan = planExport([file({ title: "   " })], "g2e");
    expect(plan[0].path).toBe("untitled.g2e");
  });
});
