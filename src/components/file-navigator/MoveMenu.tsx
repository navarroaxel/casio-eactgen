import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EactFile } from "@/lib/project";

interface MoveMenuProps {
  file: EactFile;
  folders: string[];
  onMove: (id: string, folder: string | null) => void;
}

export function MoveMenu({ file, folders, onMove }: MoveMenuProps) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;
  const close = useCallback(() => setPos(null), []);

  // The file list scrolls and clips, so the menu is portalled to the body and
  // positioned from the button's rect; close it on any outside interaction.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t))
        close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const toggle = () => {
    const btn = btnRef.current;
    if (open || !btn) return close();
    const r = btn.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  const move = (folder: string | null) => {
    onMove(file.id, folder);
    close();
  };

  const options: { label: string; value: string | null }[] = [
    { label: "(root)", value: null },
    ...folders.map((f) => ({ label: f, value: f })),
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="Move to folder"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded px-1 text-sm opacity-0 transition group-hover:opacity-100 hover:bg-black/10 aria-expanded:opacity-100 dark:hover:bg-white/10"
      >
        🗂
      </button>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 max-h-60 min-w-[9rem] overflow-y-auto rounded-md border border-black/10 bg-white py-1 text-sm shadow-lg dark:border-white/15 dark:bg-neutral-900"
          >
            {options.map((o) => {
              const current = o.value === file.folder;
              return (
                <button
                  key={o.value ?? "__root__"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  onClick={() => move(o.value)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/10 ${
                    current
                      ? "font-medium text-emerald-700 dark:text-emerald-400"
                      : ""
                  }`}
                >
                  <span className="w-3">{current ? "✓" : ""}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
