// Pure FEFO (First-Expiry-First-Out) allocation logic, split out of
// lib/inventory.ts so it can be unit tested without a database or the
// Next.js "server-only" boundary. Perishable stock (medicine) must be sold
// from the batch expiring soonest first, never from whichever batch happens
// to be cheapest or newest — that's the whole point of per-batch tracking
// instead of a single net_stock total.

export type FEFOBatch = {
  id: string;
  remaining: number;
  expiryDate: Date;
};

export type FEFOAllocation = {
  id: string;
  take: number;
};

/**
 * Decide how to satisfy `qty` units of demand from `batches`, earliest
 * expiry first. Does not mutate its input and does not touch the database —
 * callers (e.g. decrementStockFEFO) are responsible for writing the result
 * back inside a transaction.
 *
 * Throws INSUFFICIENT_STOCK if the batches don't have enough total quantity.
 */
export function allocateFEFO(batches: FEFOBatch[], qty: number): FEFOAllocation[] {
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity must be positive");
  }

  const sorted = [...batches].sort(
    (a, b) => a.expiryDate.getTime() - b.expiryDate.getTime(),
  );

  const total = sorted.reduce((sum, b) => sum + Math.max(0, b.remaining), 0);
  if (total < qty) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  const allocations: FEFOAllocation[] = [];
  let toDeduct = qty;
  for (const b of sorted) {
    if (toDeduct <= 0) break;
    if (b.remaining <= 0) continue;
    const take = Math.min(b.remaining, toDeduct);
    allocations.push({ id: b.id, take });
    toDeduct -= take;
  }
  return allocations;
}
