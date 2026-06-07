/** Parse API deadline strings as UTC (SQLite returns naive timestamps). */
export function parseDeadlineMs(deadline: string): number {
  const value = deadline.trim();
  if (!value) return NaN;
  const normalized =
    value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
}

export function isDeadlineActive(deadline: string | null | undefined): boolean {
  if (!deadline) return true;
  const deadlineMs = parseDeadlineMs(deadline);
  if (Number.isNaN(deadlineMs)) return true;
  return deadlineMs > Date.now();
}
