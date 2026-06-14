// Integration test: exercise the same Prisma operations completeSale() uses,
// to verify the schema + FEFO logic against the real DB. Safe to re-run.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failures++;
};

const drug = await prisma.drug.findFirst({
  where: { name: "Paracetamol 500mg" },
  include: { stocks: true },
});
if (!drug) throw new Error("seed missing");

const now = new Date();
const before = drug.stocks
  .filter((s) => s.remaining > 0 && s.expiryDate > now)
  .reduce((a, s) => a + s.remaining, 0);

const SELL = 7;
const receipt = await prisma.$transaction(async (tx) => {
  // FEFO decrement (mirror of decrementStockFEFO)
  const batches = await tx.stock.findMany({
    where: { drugId: drug.id, remaining: { gt: 0 }, expiryDate: { gt: now } },
    orderBy: { expiryDate: "asc" },
  });
  let left = SELL;
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(b.remaining, left);
    await tx.stock.update({ where: { id: b.id }, data: { remaining: b.remaining - take } });
    left -= take;
  }
  const total = drug.price * SELL;
  return tx.sale.create({
    data: {
      serial: `TEST-${Date.now().toString(36)}`,
      total,
      paid: total,
      discount: 0,
      balance: 0,
      items: {
        create: [{ drugName: drug.name, quantity: SELL, price: drug.price, unit: drug.unit }],
      },
    },
    include: { items: true },
  });
});

const after = (
  await prisma.stock.findMany({
    where: { drugId: drug.id, expiryDate: { gt: now } },
  })
).reduce((a, s) => a + s.remaining, 0);

check("stock decremented by exactly SELL", before - after === SELL);
check("sale persisted with 1 item", receipt.items.length === 1);
check("sale total = price * qty", receipt.total === drug.price * SELL);

// Roll back the test mutation so the demo data stays clean.
await prisma.saleItem.deleteMany({ where: { saleId: receipt.id } });
await prisma.sale.delete({ where: { id: receipt.id } });
const firstBatch = await prisma.stock.findFirst({
  where: { drugId: drug.id, expiryDate: { gt: now } },
  orderBy: { expiryDate: "asc" },
});
await prisma.stock.update({
  where: { id: firstBatch.id },
  data: { remaining: firstBatch.remaining + SELL },
});
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
