// Recreates the e2e database from scratch: delete the file, apply the real
// migrations, then seed fictional data. Run by Playwright's webServer command
// before `next start`, so the server never sees a half-built database.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { E2E_DATABASE_URL, E2E_DB_FILE, assertE2EDatabase, e2ePrisma } from "./db";
import {
  MANAGER,
  PHARMACIST,
  SUPPLIER,
  SALE_DRUG,
  RECEIVE_DRUG,
  DELETE_DRUG,
} from "./fixtures";

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

export function removeE2EDatabase(): void {
  for (const f of [E2E_DB_FILE, `${E2E_DB_FILE}-journal`]) fs.rmSync(f, { force: true });
}

async function main() {
  assertE2EDatabase(E2E_DATABASE_URL);
  removeE2EDatabase();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });

  const prisma = e2ePrisma();
  try {
    const manager = await prisma.user.create({
      data: {
        pfno: MANAGER.pfno,
        firstName: MANAGER.firstName,
        lastName: MANAGER.lastName,
        role: "MANAGER",
        passwordHash: await bcrypt.hash(MANAGER.password, 10),
      },
    });
    await prisma.user.create({
      data: {
        pfno: PHARMACIST.pfno,
        firstName: PHARMACIST.firstName,
        lastName: PHARMACIST.lastName,
        role: "PHARMACIST",
        passwordHash: await bcrypt.hash(PHARMACIST.password, 10),
      },
    });
    const supplier = await prisma.supplier.create({
      data: { name: SUPPLIER, phone: "0000000000", createdById: manager.id },
    });

    const drugs = [
      { ...SALE_DRUG, batches: [SALE_DRUG.soonBatch, SALE_DRUG.lateBatch] },
      { ...RECEIVE_DRUG, batches: [RECEIVE_DRUG.batch] },
      { ...DELETE_DRUG, batches: [DELETE_DRUG.batch, DELETE_DRUG.guardBatch] },
    ];
    for (const d of drugs) {
      await prisma.drug.create({
        data: {
          name: d.name,
          form: "Tablet",
          unit: "pcs",
          price: d.price,
          createdById: manager.id,
          stocks: {
            create: d.batches.map((b) => ({
              batchNo: b.batchNo,
              quantity: b.qty,
              remaining: b.qty,
              buyingPrice: Math.round(d.price * 0.6),
              sellingPrice: d.price,
              expiryDate: daysFromNow(b.days),
              supplierId: supplier.id,
              createdById: manager.id,
            })),
          },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(`e2e database ready at ${E2E_DB_FILE}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
