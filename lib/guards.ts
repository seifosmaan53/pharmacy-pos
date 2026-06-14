import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

/**
 * For use in pages/layouts and Server Actions. Returns the user, or redirects
 * to /login when unauthenticated. Because Server Actions are reachable by direct
 * POST, EVERY action must call this (or requireManager) before mutating.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireManager() {
  const user = await requireUser();
  if (user.role !== "MANAGER") redirect("/dashboard?denied=1");
  return user;
}
