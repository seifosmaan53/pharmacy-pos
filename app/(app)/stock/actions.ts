"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/guards";
import { toCents } from "@/lib/money";
import { logEvent } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

const StockSchema = z.object({
  drugId: z.string().min(1, "Select a drug"),
  supplierId: z.string().min(1, "Select a supplier"),
  quantity: z.coerce.number().int().positive("Quantity must be > 0"),
  buyingPrice: z.coerce.number().nonnegative(),
  sellingPrice: z.coerce.number().positive("Selling price must be > 0"),
  batchNo: z.string().trim().optional(),
  expiryDate: z.string().min(1, "Expiry date is required"),
});

export async function createStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireManager();
  const parsed = StockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const d = parsed.data;
  const expiry = new Date(d.expiryDate);
  if (Number.isNaN(expiry.getTime())) return { error: "Invalid expiry date" };
  if (expiry.getTime() <= Date.now())
    return { error: "Expiry date must be in the future." };
  if (d.sellingPrice < d.buyingPrice)
    return { error: "Selling price cannot be below the buying price." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.stock.create({
        data: {
          drugId: d.drugId,
          supplierId: d.supplierId,
          quantity: d.quantity,
          remaining: d.quantity,
          buyingPrice: toCents(d.buyingPrice),
          sellingPrice: toCents(d.sellingPrice),
          batchNo: d.batchNo || null,
          expiryDate: expiry,
          createdById: user.id,
        },
      });
      // Mirror original behavior: the drug's current selling price follows the
      // most recent batch received.
      await tx.drug.update({
        where: { id: d.drugId },
        data: { price: toCents(d.sellingPrice) },
      });
    });
  } catch {
    return { error: "Could not receive stock. Check the drug and supplier exist." };
  }

  await logEvent(user.id, "STOCK_ADD", `Received ${d.quantity} units of stock`);
  revalidatePath("/stock");
  revalidatePath("/drugs");
  return { ok: true };
}

export async function deleteStock(formData: FormData) {
  const me = await requireManager();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.stock.delete({ where: { id } });
    await logEvent(me.id, "STOCK_DELETE", `Deleted stock batch ${id}`);
    revalidatePath("/stock");
    revalidatePath("/drugs");
  }
}
