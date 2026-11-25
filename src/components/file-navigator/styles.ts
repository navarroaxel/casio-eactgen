// Shared Tailwind class strings for the navigator's repeated control styles.

const BORDERED =
  "rounded-md border border-black/15 px-2 py-1 text-xs transition dark:border-white/15";

/** Bordered button that highlights emerald on hover (create actions). */
export const ACCENT_BTN = `${BORDERED} hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`;

/** Bordered button with a neutral hover (project I/O actions). */
export const NEUTRAL_BTN = `${BORDERED} hover:bg-black/5 dark:hover:bg-white/10`;

/** Small icon button revealed when its row (`group`) is hovered. */
export const HOVER_ICON_BTN =
  "rounded px-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10";

export const PRIMARY_BTN =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700";

export const SECONDARY_BTN =
  "rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10";
