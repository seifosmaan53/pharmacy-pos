import "server-only";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export const LOW_STOCK_THRESHOLD = 10;

/** A drug plus its computed live availability from non-expired batches. */
export type DrugWithStock = {
  id: string;
  name: string;
  form: string;
  unit: string;
  price: number; // cents
  available: number; // sum of remaining across non-expired batches
  nearestExpiry: Date | null;
  expiredQty: number; // remaining sitting in expired batches (cannot sell)
};

export async function listDrugsWithStock(): Promise<DrugWithStock[]> {
  const now = new Date();
  const drugs = await prisma.drug.findMany({
    orderBy: { name: "asc" },
    include: { stocks: true },
  });

  return drugs.map((d) => {
    let available = 0;
    let expiredQty = 0;
    let nearestExpiry: Date | null = null;
    for (const s of d.stocks) {
      if (s.remaining <= 0) continue;
      if (s.expiryDate <= now) {
        expiredQty += s.remaining;
      } else {
        available += s.remaining;
        if (!nearestExpiry || s.expiryDate < nearestExpiry) {
          nearestExpiry = s.expiryDate;
        }
      }
    }
    return {
      id: d.id,
      name: d.name,
      form: d.form,
      unit: d.unit,
      price: d.price,
      available,
      nearestExpiry,
      expiredQty,
    };
  });
}

/** Drugs that currently have sellable (non-expired) stock and a real price. */
export async function listSellableDrugs(): Promise<DrugWithStock[]> {
  return (await listDrugsWithStock()).filter(
    (d) => d.available > 0 && d.price > 0,
  );
}

/**
 * Decrement `qty` units of a drug across its non-expired batches, earliest
 * expiry first (FEFO — First-Expiry-First-Out, the correct practice for
 * perishable medicines). Throws if there isn't enough sellable stock.
 *
 * MUST be called inside a transaction (`tx`) so the read-then-write of each
 * batch is atomic and two concurrent sales can't oversell.
 */
export async function decrementStockFEFO(
  tx: Prisma.TransactionClient,
  drugId: string,
  qty: number,
): Promise<void> {
  if (qty <= 0) throw new Error("Quantity must be positive");

  const batches = await tx.stock.findMany({
    where: { drugId, remaining: { gt: 0 }, expiryDate: { gt: new Date() } },
    orderBy: { expiryDate: "asc" },
  });

  const total = batches.reduce((sum, b) => sum + b.remaining, 0);
  if (total < qty) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  let toDeduct = qty;
  for (const b of batches) {
    if (toDeduct <= 0) break;
    const take = Math.min(b.remaining, toDeduct);
    await tx.stock.update({
      where: { id: b.id },
      data: { remaining: b.remaining - take },
    });
    toDeduct -= take;
  }
}
