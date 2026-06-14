// All money is stored as integer cents. Convert only at the edges.

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "KSh";

// Sanity ceiling: no single amount should exceed ~10 million units. Guards
// against fat-finger / overflow values corrupting reconciliation.
const MAX_AMOUNT = 10_000_000;

/** "12.50" | 12.5 -> 1250 cents. Throws on garbage or absurd values. */
export function toCents(value: string | number): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
    throw new Error("Invalid amount");
  }
  return Math.round(n * 100);
}

/** 1250 -> 12.5 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** 1250 -> "KSh 12.50" */
export function formatMoney(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return `${CURRENCY} ${fromCents(safe).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
