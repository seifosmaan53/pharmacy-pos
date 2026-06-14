"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/guards";
import { logEvent } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

const SupplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  address: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

export async function createSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireManager();
  const parsed = SupplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await prisma.supplier.create({
    data: { ...parsed.data, createdById: user.id },
  });
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function updateSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };
  const parsed = SupplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await prisma.supplier.update({ where: { id }, data: parsed.data });
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function deleteSupplier(formData: FormData) {
  const me = await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Deleting a supplier cascades to its stock batches — block if any exist.
  const batches = await prisma.stock.count({ where: { supplierId: id } });
  if (batches > 0) {
    throw new Error("Cannot delete a supplier that has stock batches on record.");
  }
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  await prisma.supplier.delete({ where: { id } });
  await logEvent(me.id, "SUPPLIER_DELETE", `Deleted supplier ${supplier?.name ?? id}`);
  revalidatePath("/suppliers");
}
