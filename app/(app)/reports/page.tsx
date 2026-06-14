import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { parseRange, toDateInput } from "@/lib/dates";
import {
  PageHeader,
  Card,
  Table,
  Th,
  Td,
  EmptyState,
  LinkButton,
} from "@/components/ui";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const { from, to } = await searchParams;
  const { start, end } = parseRange(from, to);

  const [sales, items] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      include: { soldBy: true, _count: { select: { items: true } } },
    }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: start, lte: end } } },
      select: { drugName: true, quantity: true, price: true },
    }),
  ]);

  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const unitsSold = items.reduce((s, i) => s + i.quantity, 0);

  // Top drugs by revenue (computed in JS — groupBy can't multiply columns).
  const byDrug = new Map<string, { qty: number; revenue: number }>();
  for (const i of items) {
    const cur = byDrug.get(i.drugName) ?? { qty: 0, revenue: 0 };
    cur.qty += i.quantity;
    cur.revenue += i.price * i.quantity;
    byDrug.set(i.drugName, cur);
  }
  const topDrugs = [...byDrug.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const exportHref = `/reports/export?from=${toDateInput(start)}&to=${toDateInput(end)}`;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales performance over a date range"
        action={
          <div className="flex gap-2 no-print">
            <LinkButton href={exportHref} variant="secondary">
              ⬇ Export CSV
            </LinkButton>
          </div>
        }
      />

      <Card className="mb-6 p-4 no-print">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">From</span>
            <input
              type="date"
              name="from"
              defaultValue={toDateInput(start)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">To</span>
            <input
              type="date"
              name="to"
              defaultValue={toDateInput(end)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Apply
          </button>
        </form>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatMoney(revenue)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{sales.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">Units sold</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{unitsSold}</p>
        </Card>
      </div>

      {topDrugs.length > 0 && (
        <Card className="mb-6">
          <div className="border-b border-gray-100 px-4 py-3 font-medium text-gray-900">
            Top selling drugs
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Drug</Th>
                <Th>Units</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {topDrugs.map((d) => (
                <tr key={d.name}>
                  <Td className="font-medium text-gray-900">{d.name}</Td>
                  <Td>{d.qty}</Td>
                  <Td className="text-right">{formatMoney(d.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 font-medium text-gray-900">
          Sales ({sales.length})
        </div>
        {sales.length === 0 ? (
          <EmptyState message="No sales in this period." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Served by</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium">
                    <a
                      href={`/api/receipt/${s.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                      title="Open PDF receipt"
                    >
                      {s.serial}
                    </a>
                  </Td>
                  <Td className="text-gray-500">{s.createdAt.toLocaleString()}</Td>
                  <Td>{s._count.items}</Td>
                  <Td className="text-gray-500">
                    {s.soldBy ? `${s.soldBy.firstName} ${s.soldBy.lastName}` : "—"}
                  </Td>
                  <Td className="text-right">{formatMoney(s.total)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
