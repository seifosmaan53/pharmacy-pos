"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/guards";
import { logEvent } from "@/lib/audit";

export type FormState = { ok?: boolean; error?: string };

const Base = z.object({
  pfno: z.string().trim().min(1, "Staff number is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  role: z.enum(["MANAGER", "PHARMACIST"]),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  gender: z.string().trim().optional(),
});

async function activeManagerCount() {
  return prisma.user.count({ where: { role: "MANAGER", active: true } });
}

export async function createStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireManager();
  const parsed = Base.extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { password, ...data } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { pfno: data.pfno } });
  if (exists) return { error: "That staff number is already taken." };

  await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
  });
  await logEvent(me.id, "STAFF_ADD", `Added staff ${data.firstName} ${data.lastName} (${data.role})`);
  revalidatePath("/staff");
  return { ok: true };
}

export async function updateStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id" };
  const parsed = Base.extend({
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { password, pfno, ...rest } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: "Staff member not found." };

  // Guard pfno uniqueness if changed.
  const clash = await prisma.user.findFirst({ where: { pfno, id: { not: id } } });
  if (clash) return { error: "That staff number is already taken." };

  // Invariants: never strip the last manager, never demote yourself.
  if (target.role === "MANAGER" && rest.role !== "MANAGER") {
    if (id === me.id) return { error: "You cannot remove your own manager role." };
    if ((await activeManagerCount()) <= 1)
      return { error: "At least one active manager is required." };
  }

  await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      pfno,
      // Changing a password invalidates that user's existing sessions.
      ...(password
        ? {
            passwordHash: await bcrypt.hash(password, 10),
            tokenVersion: { increment: 1 },
          }
        : {}),
    },
  });
  await logEvent(me.id, "STAFF_UPDATE", `Updated staff ${rest.firstName} ${rest.lastName}`);
  revalidatePath("/staff");
  return { ok: true };
}

export async function toggleStaffActive(formData: FormData) {
  const me = await requireManager();
  const id = String(formData.get("id") ?? "");
  if (!id || id === me.id) return; // can't disable yourself
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return;
  // Don't disable the last active manager.
  if (u.active && u.role === "MANAGER" && (await activeManagerCount()) <= 1) return;
  await prisma.user.update({
    where: { id },
    data: {
      active: !u.active,
      // Disabling someone should also kill their live sessions.
      ...(u.active ? { tokenVersion: { increment: 1 } } : {}),
    },
  });
  await logEvent(me.id, "STAFF_TOGGLE", `${u.active ? "Disabled" : "Enabled"} ${u.firstName} ${u.lastName}`);
  revalidatePath("/staff");
}
