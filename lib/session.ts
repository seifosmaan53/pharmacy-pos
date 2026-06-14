import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const COOKIE = "pos_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

// Fail fast rather than silently signing tokens with a guessable default — a
// known secret would let anyone forge a manager session.
const rawSecret = process.env.SESSION_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set to a random string of at least 32 characters.",
  );
}
const secret = new TextEncoder().encode(rawSecret);

export type SessionPayload = {
  userId: string;
  pfno: string;
  role: Role;
  tv: number; // tokenVersion snapshot
};

/** Sign a JWT and store it in an httpOnly cookie. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true, // not readable by JS -> mitigates XSS token theft
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // mitigates CSRF on top-level navigations
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Verify the cookie JWT. Returns null if missing/expired/tampered. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Load the full user record for the current session. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;
  // Reject tokens minted before the user's tokenVersion was bumped (logout,
  // password change, forced revocation).
  if (session.tv !== user.tokenVersion) return null;
  return user;
}

/** Throws (caller should redirect) when there is no valid session. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
