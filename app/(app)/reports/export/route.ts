import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { fromCents } from "@/lib/money";
import { parseRange, toDateInput } from "@/lib/dates";

// Prevent spreadsheet formula injection: a cell beginning with = + - @ (or a
// control char) is treated as a formula by Excel/Sheets. Prefix with a quote.
function csvSafe(value: string): string {
  const cell = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${cell.replace(/"/g, '""')}"`;
}

// CSV export of sales line-items in a date range. Auth-checked like any page.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = req.nextUrl;
  const { start, end } = parseRange(
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined,
  );

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "asc" },
    include: { items: true, soldBy: true },
  });

  const rows: string[][] = [
    ["Receipt", "Date", "Drug", "Quantity", "Unit", "Unit Price", "Line Total", "Served By"],
  ];
  for (const s of sales) {
    for (const it of s.items) {
      rows.push([
        s.serial,
        s.createdAt.toISOString(),
        it.drugName,
        String(it.quantity),
        it.unit,
        fromCents(it.price).toFixed(2),
        fromCents(it.price * it.quantity).toFixed(2),
        s.soldBy ? `${s.soldBy.firstName} ${s.soldBy.lastName}` : "",
      ]);
    }
  }

  const csv = rows.map((r) => r.map(csvSafe).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-${toDateInput(start)}-to-${toDateInput(end)}.csv"`,
    },
  });
}
