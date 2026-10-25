// Shared database helpers for the Playwright suite.
//
// The suite runs against its own throwaway SQLite file (prisma/e2e.db), never
// against dev.db or any other database. The path is fixed here, not read from
// the environment, so a stray DATABASE_URL in the shell can't point the tests
// at real data.
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const E2E_DB_FILE = path.resolve(__dirname, "..", "prisma", "e2e.db");
export const E2E_DATABASE_URL = `file:${E2E_DB_FILE}`;

/** Refuse to run against anything other than the dedicated e2e database file. */
export function assertE2EDatabase(url: string): void {
  if (url !== E2E_DATABASE_URL || path.basename(E2E_DB_FILE) !== "e2e.db") {
    throw new Error(`Refusing to touch a non-e2e database: ${url}`);
  }
}

/** A Prisma client bound to the e2e database, for direct persistence checks. */
export function e2ePrisma(): PrismaClient {
  assertE2EDatabase(E2E_DATABASE_URL);
  return new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
}
