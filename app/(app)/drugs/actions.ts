"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireManager } from "@/lib/guards";
import { toCents } from "@/lib/money";
import { logEvent } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

const DrugSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  form: z.string().trim().min(1, "Form is required"),
  unit: z.string().trim().min(1, "Unit is required"),
  price: z.coerce.number().nonnegative("Price must be ≥ 0"),
});

export async function createDrug(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = DrugSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, form, unit, price } = parsed.data;
  await prisma.drug.create({
    data: { name, form, unit, price: toCents(price), createdById: user.id },
  });
  revalidatePath("/drugs");
  return { ok: true };
}

export async function updateDrug(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };
  const parsed = DrugSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, form, unit, price } = parsed.data;
  await prisma.drug.update({
    where: { id },
    data: { name, form, unit, price: toCents(price) },
  });
  revalidatePath("/drugs");
  return { ok: true };
}

export async function deleteDrug(formData: FormData) {
  const me = await requireManager(); // deleting catalog items is a manager action
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Block deletion while sellable stock remains — deleting cascades to all
  // stock batches and would silently destroy inventory history.
  const remaining = await prisma.stock.aggregate({
    _sum: { remaining: true },
    where: { drugId: id, remaining: { gt: 0 }, expiryDate: { gt: new Date() } },
  });
  if ((remaining._sum.remaining ?? 0) > 0) {
    throw new Error("Cannot delete a drug that still has stock. Clear its stock first.");
  }

  const drug = await prisma.drug.findUnique({ where: { id } });
  await prisma.drug.delete({ where: { id } });
  await logEvent(me.id, "DRUG_DELETE", `Deleted drug ${drug?.name ?? id}`);
  revalidatePath("/drugs");
}
