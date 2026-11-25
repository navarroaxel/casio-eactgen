import { useRef } from "react";
import type { LinkStatus } from "./types";
import { NEUTRAL_BTN } from "./styles";

interface ProjectFooterProps {
  // Fallback (download/upload) — used when the File System Access API is absent.
  onSave: () => void;
  onLoad: (file: File) => void;
  // Import compiled .g1e/.g2e/.g3e eActivities back into editable files.
  onImport: (files: FileList) => void;
  // File System Access: link the project to a file on disk and auto-save there.
  fsSupported: boolean;
  linkStatus: LinkStatus;
  linkedName: string | null;
  onLinkSave: () => void;
  onOpenDisk: () => void;
  onReconnect: () => void;
  onUnlink: () => void;
}

const flexBtn = `flex-1 ${NEUTRAL_BTN}`;

export function ProjectFooter(p: ProjectFooterProps) {
  const loadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-auto flex flex-col gap-1 border-t border-black/10 pt-2 dark:border-white/10">
      {p.fsSupported ? (
        <>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={p.onLinkSave}
              title="Save to a file on disk and keep auto-saving there"
              className={flexBtn}
            >
              Save to file…
            </button>
            <button
              type="button"
              onClick={p.onOpenDisk}
              title="Open a .eam.json project from disk"
              className={flexBtn}
            >
              Open from file…
            </button>
          </div>
          {p.linkStatus === "linked" && (
            <div className="flex items-center gap-1 px-1 text-xs text-emerald-700 dark:text-emerald-400">
              <span aria-hidden>●</span>
              <span
                className="min-w-0 flex-1 truncate"
                title={p.linkedName ?? undefined}
              >
                Auto-saving to {p.linkedName}
              </span>
              <button
                type="button"
                onClick={p.onUnlink}
                title="Stop auto-saving to this file"
                className="rounded px-1 text-black/40 hover:bg-black/10 dark:text-white/40 dark:hover:bg-white/10"
              >
                ×
              </button>
            </div>
          )}
          {p.linkStatus === "needs-permission" && (
            <button
              type="button"
              onClick={p.onReconnect}
              title="Re-grant access to resume auto-saving"
              className="rounded-md border border-amber-500/50 px-2 py-1 text-xs text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
            >
              Reconnect {p.linkedName}
            </button>
          )}
          <p className="px-1 text-[11px] leading-tight text-black/40 dark:text-white/40">
            Tip: save into a Google Drive / Dropbox folder to sync across
            devices.
          </p>
        </>
      ) : (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={p.onSave}
            title="Download the whole project as a .eam.json file"
            className={flexBtn}
          >
            Save project
          </button>
          <button
            type="button"
            onClick={() => loadRef.current?.click()}
            title="Load a .eam.json project file"
            className={flexBtn}
          >
            Load project
          </button>
          <input
            ref={loadRef}
            type="file"
            accept=".json,.eam,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onLoad(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {/* Import compiled eActivities back into editable files — works in
        every browser (read-only file input, no File System Access API). */}
      <button
        type="button"
        onClick={() => importRef.current?.click()}
        title="Import .g1e / .g2e / .g3e files made elsewhere or on the calculator"
        className={NEUTRAL_BTN}
      >
        Import .g*e…
      </button>
      <input
        ref={importRef}
        type="file"
        accept=".g1e,.g2e,.g3e"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) p.onImport(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
