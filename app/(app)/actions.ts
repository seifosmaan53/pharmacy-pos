"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, destroySession } from "@/lib/session";
import { logEvent } from "@/lib/audit";

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    // Bump tokenVersion so the (now-cleared) cookie can't be replayed even if
    // someone captured its value before logout.
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await logEvent(user.id, "LOGOUT", `${user.firstName} ${user.lastName} logged out`);
  }
  await destroySession();
  redirect("/login");
}
