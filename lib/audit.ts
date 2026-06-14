import "server-only";
import { prisma } from "./prisma";

/** Append-only activity log (mirrors the original app's `events` table). */
export async function logEvent(
  userId: string | null,
  action: string,
  description: string,
) {
  await prisma.auditEvent.create({ data: { userId, action, description } });
}
