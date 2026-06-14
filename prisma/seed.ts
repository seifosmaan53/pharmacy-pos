import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const cents = (n: number) => Math.round(n * 100);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

async function main() {
  // Wipe (dev convenience) — children first to respect FKs.
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.debtor.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.drug.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.user.deleteMany();

  const manager = await prisma.user.create({
    data: {
      pfno: "1001",
      firstName: "Seif",
      lastName: "Osman",
      role: "MANAGER",
      gender: "Male",
      passwordHash: await bcrypt.hash("admin123", 10),
    },
  });

  await prisma.user.create({
    data: {
      pfno: "2001",
      firstName: "Pat",
      lastName: "Cashier",
      role: "PHARMACIST",
      gender: "Female",
      passwordHash: await bcrypt.hash("cashier123", 10),
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "MediSupply Ltd",
      phone: "0700000000",
      location: "Nairobi",
      createdById: manager.id,
    },
  });

  const drugSeed = [
    { name: "Paracetamol 500mg", form: "Tablet", unit: "pcs", price: 5, qty: 500, exp: 365 },
    { name: "Amoxicillin 250mg", form: "Capsule", unit: "pcs", price: 12, qty: 200, exp: 120 },
    { name: "Cough Syrup", form: "Syrup", unit: "ml", price: 150, qty: 40, exp: 20 }, // expires soon
    { name: "Ibuprofen 400mg", form: "Tablet", unit: "pcs", price: 8, qty: 0, exp: 365 }, // out of stock
    { name: "ORS Sachet", form: "Powder", unit: "pcs", price: 25, qty: 5, exp: 200 }, // low stock
  ];

  for (const d of drugSeed) {
    const drug = await prisma.drug.create({
      data: {
        name: d.name,
        form: d.form,
        unit: d.unit,
        price: cents(d.price),
        createdById: manager.id,
      },
    });
    if (d.qty > 0) {
      await prisma.stock.create({
        data: {
          drugId: drug.id,
          supplierId: supplier.id,
          batchNo: `B-${drug.id.slice(-4)}`,
          quantity: d.qty,
          remaining: d.qty,
          buyingPrice: cents(d.price * 0.6),
          sellingPrice: cents(d.price),
          expiryDate: daysFromNow(d.exp),
          createdById: manager.id,
        },
      });
    }
  }

  console.log("Seeded. Manager login: pfno 1001 / admin123 — Cashier: 2001 / cashier123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
