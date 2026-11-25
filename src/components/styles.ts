// Shared Tailwind class strings for the editor's repeated control styles.
// (The file navigator keeps its own in ./file-navigator/styles.)

const ACCENT_HOVER =
  "hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10";

/** Insert-snippet buttons (math toolbar, character palette). */
export const SNIPPET_BTN = `border border-black/15 bg-white dark:border-white/15 dark:bg-white/[0.04] ${ACCENT_HOVER}`;

/** Outlined emerald action (secondary actions bar). */
export const OUTLINE_ACTION_BTN =
  "rounded-lg border border-emerald-600/40 px-4 py-2.5 font-medium text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10";

export const PRIMARY_ACTION_BTN =
  "rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-700";

export const WARN_ACTION_BTN =
  "rounded-lg border border-amber-500/50 px-4 py-2.5 font-medium text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10";
