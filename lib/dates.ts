// Local-timezone date helpers. Using `new Date("YYYY-MM-DD")` parses as UTC
// midnight, which combined with local setHours() silently shifts the range by
// the timezone offset. These helpers stay in local time end-to-end so the
// reports page and the CSV export always cover the exact same window.

/** Date -> "YYYY-MM-DD" in LOCAL time (for <input type="date"> values). */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a "YYYY-MM-DD" string into a local Date at the given end of day. */
function parseLocal(s: string | undefined, endOfDay: boolean): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Resolve a [start, end] range from optional date strings, defaulting to the
 * last 30 days. Invalid inputs fall back to the defaults.
 */
export function parseRange(from?: string, to?: string): { start: Date; end: Date } {
  const end = parseLocal(to, true) ?? endOfToday();
  const start = parseLocal(from, false) ?? new Date(end.getTime() - 30 * 86_400_000);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
