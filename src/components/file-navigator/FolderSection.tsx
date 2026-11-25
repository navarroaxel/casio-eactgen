import type { ReactNode } from "react";
import { HOVER_ICON_BTN } from "./styles";

interface FolderSectionProps {
  name: string;
  collapsed: boolean;
  onToggle: () => void;
  onNewFile: () => void;
  onRename: () => void;
  onDelete: () => void;
  children: ReactNode;
}

export function FolderSection({
  name,
  collapsed,
  onToggle,
  onNewFile,
  onRename,
  onDelete,
  children,
}: FolderSectionProps) {
  return (
    <li className="mt-1">
      <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={collapsed ? `Expand ${name}` : `Collapse ${name}`}
          className="mr-auto flex min-w-0 items-center gap-1 text-left"
        >
          <span aria-hidden className="w-3 shrink-0 text-[10px]">
            {collapsed ? "▸" : "▾"}
          </span>
          <span className="truncate" title={name}>
            📁 {name}
          </span>
        </button>
        <button
          type="button"
          onClick={onNewFile}
          title={`New file in ${name}`}
          className={HOVER_ICON_BTN}
        >
          +
        </button>
        <button
          type="button"
          onClick={onRename}
          title={`Rename ${name}`}
          className={HOVER_ICON_BTN}
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onDelete}
          title={`Delete folder "${name}" (its files move to the root)`}
          className={HOVER_ICON_BTN}
        >
          ×
        </button>
      </div>
      {!collapsed && (
        <ul className="ml-3 flex flex-col gap-0.5 border-l border-black/10 pl-1 dark:border-white/10">
          {children}
        </ul>
      )}
    </li>
  );
}
