import type { EactFile } from "@/lib/project";
import { MoveMenu } from "./MoveMenu";
import { HOVER_ICON_BTN } from "./styles";

export const fileName = (f: EactFile) => f.title.trim() || "Untitled";

interface FileRowProps {
  file: EactFile;
  folders: string[];
  active: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string | null) => void;
}

export function FileRow({
  file,
  folders,
  active,
  onSelect,
  onEdit,
  onDelete,
  onMove,
}: FileRowProps) {
  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(file.id)}
        onDoubleClick={() => onEdit(file.id)}
        className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm transition ${
          active
            ? "bg-emerald-600 text-white"
            : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
        title={`${fileName(file)} — double-click to rename`}
      >
        {fileName(file)}
      </button>
      {folders.length > 0 && (
        <MoveMenu file={file} folders={folders} onMove={onMove} />
      )}
      <button
        type="button"
        onClick={() => onEdit(file.id)}
        title="Rename file"
        className={`${HOVER_ICON_BTN} text-sm`}
      >
        ✎
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Delete "${fileName(file)}"?`)) onDelete(file.id);
        }}
        title="Delete file"
        className={`${HOVER_ICON_BTN} text-sm`}
      >
        ×
      </button>
    </li>
  );
}
