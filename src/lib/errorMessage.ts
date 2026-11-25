/** Human-readable message from anything that was thrown. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
