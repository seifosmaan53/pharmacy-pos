"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { decrementStockFEFO } from "@/lib/inventory";
import { toCents } from "@/lib/money";
import { logEvent } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

const AddSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  drugId: z.string().min(1, "Select a drug"),
  quantity: z.coerce.number().int().positive("Quantity must be > 0"),
  deposit: z.coerce.number().nonnegative().default(0),
  dueDate: z.string().optional(),
});

export async function addDebtor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = AddSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const drug = await tx.drug.findUnique({ where: { id: d.drugId } });
      if (!drug) throw new Error("Drug not found");
      if (drug.price <= 0) throw new Error("PRICE");
      // Drugs leave the shelf even on credit -> decrement stock now.
      await decrementStockFEFO(tx, d.drugId, d.quantity);

      const amountOwed = drug.price * d.quantity;
      // A deposit can't exceed what's owed.
      const depositCents = Math.min(toCents(d.deposit), amountOwed);
      await tx.debtor.create({
        data: {
          name: d.name,
          phone: d.phone,
          drugId: drug.id,
          drugName: drug.name,
          quantity: d.quantity,
          amountOwed,
          deposit: depositCents,
          settled: depositCents >= amountOwed,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          createdById: user.id,
        },
      });
    });
  } catch (e) {
    return {
      error:
        e instanceof Error && e.message === "INSUFFICIENT_STOCK"
          ? "Not enough stock to give on credit."
          : e instanceof Error && e.message === "PRICE"
            ? "That drug has no price set."
            : "Could not add debtor.",
    };
  }

  await logEvent(user.id, "DEBTOR_ADD", `Added debtor ${d.name} (${d.quantity} units)`);
  revalidatePath("/debtors");
  revalidatePath("/drugs");
  return { ok: true };
}

const RepaySchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive("Enter a positive amount"),
});

export async function repayDebtor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = RepaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  let amountCents: number;
  try {
    amountCents = toCents(parsed.data.amount);
  } catch {
    return { error: "Amount is out of range." };
  }

  // Atomic read-modify-write so concurrent repayments can't lose an update.
  try {
    await prisma.$transaction(async (tx) => {
      const debtor = await tx.debtor.findUnique({ where: { id: parsed.data.id } });
      if (!debtor) throw new Error("NOT_FOUND");
      if (debtor.settled) throw new Error("SETTLED");
      // Never store more than the amount owed.
      const newDeposit = Math.min(debtor.amountOwed, debtor.deposit + amountCents);
      await tx.debtor.update({
        where: { id: debtor.id },
        data: { deposit: newDeposit, settled: newDeposit >= debtor.amountOwed },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND")
      return { error: "Debtor not found." };
    if (e instanceof Error && e.message === "SETTLED")
      return { error: "This debt is already settled." };
    return { error: "Could not record repayment." };
  }

  await logEvent(user.id, "DEBTOR_REPAY", `Repayment of ${parsed.data.amount} recorded`);
  revalidatePath("/debtors");
  return { ok: true };
}
