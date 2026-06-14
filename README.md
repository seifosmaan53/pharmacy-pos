# Pharmacy POS

> A modern, secure web-based Pharmacy Point-of-Sale & Inventory Management System.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-ready-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)

---

## Overview

**Pharmacy POS** is a full-stack point-of-sale and inventory platform for small and medium pharmacies. It handles selling (quantity & cash sales), drug and stock control with batch expiry, suppliers, credit customers (debtors), reporting, and staff roles — in one clean, fast web app you can run anywhere.

It is a ground-up rebuild of an older Windows-only C# WinForms pharmacy system, re-engineered to be cross-platform, secure by design, and pleasant to use.

Built by **Seif Osman**.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js (App Router) | 16 | Framework + Server Actions |
| React | 19 | UI |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| Prisma | 6 | ORM + migrations |
| SQLite | — | Database (swappable to Postgres/MySQL) |
| jose | latest | JWT session cookies |
| bcryptjs | latest | Password hashing |
| Zod | latest | Input validation |
| pdf-lib | latest | PDF receipt generation |

---

## Features

- **Point of Sale** — Quantity and cash sales, live cart, discounts, change calculation, and PDF/print receipts
- **Inventory** — Drugs, stock batches, and suppliers with full CRUD and live availability
- **Batch & Expiry Control** — Per-batch tracking, sold first-expiry-first-out (FEFO), with low-stock and expiry alerts
- **Debtors** — Credit sales, deposit/balance tracking, repayments, and auto-settlement
- **Dashboard** — Today's revenue, all-time totals, outstanding debt, and stock alerts at a glance
- **Reports** — Date-range sales, top-selling drugs, CSV export, and per-sale PDF receipts
- **Staff & Roles** — Manager and Pharmacist roles with role-based access
- **Audit Log** — Logins, sales, stock, debtor, and staff changes are recorded

---

## Security

- **Hashed passwords** (bcrypt) — never stored in plain text
- **Parameterized queries** via Prisma — no SQL injection
- **Signed, httpOnly JWT sessions** with server-side revocation (logout / password change invalidates tokens)
- **Role-based authorization** enforced inside every server action
- **Server-authoritative pricing & stock** — totals and inventory are never trusted from the client
- **Money stored as integer cents** — no floating-point rounding errors
- **Atomic sales** — stock decrement and sale records commit in a single transaction

---

## Getting Started

```bash
npm install
npx prisma migrate dev    # create the local SQLite database
npm run seed              # load demo data + default logins
npm run dev               # http://localhost:3000
```

### Default logins

| Role | Staff number | Password |
|---|---|---|
| Manager | `1001` | `admin123` |
| Pharmacist | `2001` | `cashier123` |

> Change these and set a strong `SESSION_SECRET` in `.env` before any real use.

---

## Roles

- **Manager** — Full access: staff, suppliers, deletions, plus everything a pharmacist can do
- **Pharmacist** — Point of sale, debtors, viewing drugs & stock, and reports

---

## Project Structure

```
app/
  login/            Sign-in (server action + bcrypt)
  (app)/            Authenticated area (guarded by layout)
    dashboard/  pos/  drugs/  stock/  suppliers/  debtors/  reports/  staff/
  api/receipt/      PDF receipt generation
lib/
  prisma · session · guards · inventory · money · dates · audit
prisma/
  schema.prisma · seed.ts
```

---

## Notes

- Money is stored everywhere as integer cents; convert with `lib/money.ts`
- Currency label is configurable via `NEXT_PUBLIC_CURRENCY` in `.env` (default `KSh`)
- Reset the database any time with `npm run db:reset`

---

## License

Released under the [MIT License](LICENSE).

---

Built by **Seif Osman**.
