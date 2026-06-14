"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { decrementStockFEFO } from "@/lib/inventory";
import { toCents } from "@/lib/money";
import { logEvent } from "@/lib/audit";

const SaleInput = z.object({
  items: z
    .array(
      z.object({
        drugId: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1, "Cart is empty"),
  paid: z.number().nonnegative(),
  discount: z.number().nonnegative(),
});

export type ReceiptItem = {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number; // cents
  lineTotal: number; // cents
};

export type Receipt = {
  id: string;
  serial: string;
  date: string;
  cashier: string;
  items: ReceiptItem[];
  total: number;
  paid: number;
  discount: number;
  balance: number; // paid + discount - total; positive = change due
};

export type SaleResult = { ok: true; receipt: Receipt } | { ok: false; error: string };

// Cryptographically random, collision-resistant serial.
function makeSerial() {
  const t = Date.now().toString(36).toUpperCase();
  const r = randomBytes(4).toString("hex").toUpperCase();
  return `R-${t}-${r}`;
}

export async function completeSale(input: unknown): Promise<SaleResult> {
  const user = await requireUser();

  const parsed = SaleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sale" };
  }
  const { items, paid, discount } = parsed.data;

  // Merge duplicate drug lines (defensive) and load authoritative drug data.
  const merged = new Map<string, number>();
  for (const it of items) merged.set(it.drugId, (merged.get(it.drugId) ?? 0) + it.qty);

  let paidCents: number;
  let discountCents: number;
  try {
    paidCents = toCents(paid);
    discountCents = toCents(discount);
  } catch {
    return { ok: false, error: "Amount is out of range." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receiptItems: ReceiptItem[] = [];
      let total = 0;

      for (const [drugId, qty] of merged) {
        const drug = await tx.drug.findUnique({ where: { id: drugId } });
        if (!drug) throw new Error("A drug in the cart no longer exists");
        if (drug.price <= 0) throw new Error(`${drug.name} has no price set`);

        // Authoritative stock check + FEFO decrement (atomic).
        await decrementStockFEFO(tx, drugId, qty);

        const lineTotal = drug.price * qty; // price from DB, not the client
        total += lineTotal;
        receiptItems.push({
          name: drug.name,
          qty,
          unit: drug.unit,
          unitPrice: drug.price,
          lineTotal,
        });
      }

      // A discount can never exceed the bill — otherwise we'd "invent" change.
      if (discountCents > total) throw new Error("DISCOUNT_TOO_BIG");

      const serial = makeSerial();
      const balance = paidCents + discountCents - total;

      const sale = await tx.sale.create({
        data: {
          serial,
          total,
          paid: paidCents,
          discount: discountCents,
          balance,
          soldById: user.id,
          items: {
            create: receiptItems.map((r) => ({
              drugName: r.name,
              quantity: r.qty,
              price: r.unitPrice,
              unit: r.unit,
            })),
          },
        },
      });

      const receipt: Receipt = {
        id: sale.id,
        serial,
        date: sale.createdAt.toLocaleString(),
        cashier: `${user.firstName} ${user.lastName}`,
        items: receiptItems,
        total,
        paid: paidCents,
        discount: discountCents,
        balance,
      };
      return receipt;
    });

    await logEvent(user.id, "SALE", `Sold drugs worth ${result.total / 100} (${result.serial})`);
    revalidatePath("/pos");
    revalidatePath("/drugs");
    revalidatePath("/dashboard");
    return { ok: true, receipt: result };
  } catch (e) {
    return { ok: false, error: saleErrorMessage(e) };
  }
}

function saleErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "INSUFFICIENT_STOCK")
      return "Not enough stock for one or more items. Refresh and try again.";
    if (e.message === "DISCOUNT_TOO_BIG")
      return "Discount cannot be greater than the total.";
    if (e.message.includes("no longer exists") || e.message.includes("no price set"))
      return e.message;
  }
  // Unique-constraint or any other DB error -> generic (don't leak internals).
  if (e instanceof Prisma.PrismaClientKnownRequestError) return "Sale failed, please try again.";
  return "Sale failed, please try again.";
}
