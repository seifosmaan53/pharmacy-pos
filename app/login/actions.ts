"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { logEvent } from "@/lib/audit";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const pfno = String(formData.get("pfno") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!pfno || !password) {
    return { error: "Enter your staff number and password." };
  }

  // Parameterized via Prisma -> no SQL injection (unlike the original's
  // string-concatenated `WHERE pfno='{pfno}'`).
  const user = await prisma.user.findUnique({ where: { pfno } });

  // Always run a bcrypt compare even when the user is missing, so the response
  // time doesn't leak whether a staff number exists (timing-attack mitigation).
  const dummy = "$2a$10$abcdefghijklmnopqrstuv0123456789012345678901234567890a";
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummy);

  if (!user || !user.active || !ok) {
    return { error: "Invalid staff number or password." };
  }

  await createSession({
    userId: user.id,
    pfno: user.pfno,
    role: user.role,
    tv: user.tokenVersion,
  });
  await logEvent(user.id, "LOGIN", `${user.firstName} ${user.lastName} logged in`);

  redirect("/dashboard");
}
