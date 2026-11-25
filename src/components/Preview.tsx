import type { EactFormat } from "@/lib/casio";
import type { Analysis } from "@/lib/analyze";

export function Preview({
  analysis,
  format,
}: {
  analysis: Analysis;
  format: EactFormat;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">Preview</span>
      <div className="flex h-56 flex-col overflow-hidden rounded-xl border border-black/15 dark:border-white/15">
        <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-black/[0.03] px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.04]">
          <span>{analysis.lineCount} line(s)</span>
          <span>
            {analysis.size != null ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                {analysis.size} bytes · .{format}
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                encode error
              </span>
            )}
          </span>
        </div>
        {analysis.error ? (
          <div className="overflow-auto p-3 font-mono text-xs text-red-600 dark:text-red-400">
            {analysis.error}
          </div>
        ) : (
          <ol className="flex-1 overflow-auto p-3 font-mono text-sm">
            {analysis.preview.length === 0 && (
              <li className="text-black/40 dark:text-white/40">
                Nothing to preview yet.
              </li>
            )}
            {analysis.preview.map((p, i) => (
              <li
                key={i}
                className="border-b border-dashed border-black/5 py-0.5 break-words whitespace-pre-wrap last:border-0 dark:border-white/5"
              >
                {p.note ? (
                  <span className="text-sky-700 dark:text-sky-400">
                    🗒 {p.text}
                  </span>
                ) : (
                  p.text
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
