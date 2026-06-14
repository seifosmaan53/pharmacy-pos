import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { listDrugsWithStock, LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card, Badge } from "@/components/ui";

const SOON_DAYS = 30;

function StatCard({
  label,
  value,
  icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  href?: string;
  tone?: "red" | "amber";
}) {
  const accent =
    tone === "red"
      ? "bg-red-50 text-red-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : "bg-brand-50 text-brand-600";
  const valueColor =
    tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-gray-900";
  const body = (
    <Card className="flex items-center gap-4 p-5 transition hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`mt-0.5 truncate text-xl font-semibold ${valueColor}`}>{value}</p>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + SOON_DAYS);

  const [drugs, todaySales, allTimeAgg, recentSales, debtors, expiringSoon] =
    await Promise.all([
      listDrugsWithStock(),
      prisma.sale.aggregate({
        _sum: { total: true },
        _count: true,
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.sale.aggregate({ _sum: { total: true }, _count: true }),
      prisma.sale.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { soldBy: true, _count: { select: { items: true } } },
      }),
      prisma.debtor.findMany({ where: { settled: false } }),
      prisma.stock.count({
        where: { remaining: { gt: 0 }, expiryDate: { gt: new Date(), lte: soon } },
      }),
    ]);

  const outOfStock = drugs.filter((d) => d.available <= 0).length;
  const lowStock = drugs.filter(
    (d) => d.available > 0 && d.available <= LOW_STOCK_THRESHOLD,
  ).length;
  const outstanding = debtors.reduce((s, d) => s + (d.amountOwed - d.deposit), 0);
  const expiredDrugs = drugs.filter((d) => d.expiredQty > 0).length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.firstName}`}
        subtitle="Here's how your pharmacy is doing today"
      />

      {denied && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          That section is restricted to managers.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's sales"
          icon="💰"
          value={formatMoney(todaySales._sum.total ?? 0)}
        />
        <StatCard label="Transactions today" icon="🧾" value={String(todaySales._count)} />
        <StatCard
          label="All-time revenue"
          icon="📈"
          value={formatMoney(allTimeAgg._sum.total ?? 0)}
        />
        <StatCard
          label="Outstanding debt"
          icon="🪙"
          value={formatMoney(outstanding)}
          href="/debtors"
          tone={outstanding > 0 ? "amber" : undefined}
        />
        <StatCard label="Drugs in catalog" icon="💊" value={String(drugs.length)} href="/drugs" />
        <StatCard
          label="Out of stock"
          icon="🚫"
          value={String(outOfStock)}
          href="/drugs"
          tone={outOfStock > 0 ? "red" : undefined}
        />
        <StatCard
          label="Low stock"
          icon="⚠️"
          value={String(lowStock)}
          href="/drugs"
          tone={lowStock > 0 ? "amber" : undefined}
        />
        <StatCard
          label="Expiring ≤30 days"
          icon="⏳"
          value={String(expiringSoon)}
          href="/stock"
          tone={expiringSoon > 0 ? "amber" : undefined}
        />
      </div>

      {(outOfStock > 0 || expiredDrugs > 0 || lowStock > 0) && (
        <Card className="mt-6 border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 font-medium text-amber-900">⚠ Attention needed</h3>
          <ul className="space-y-1 text-sm text-amber-800">
            {outOfStock > 0 && <li>• {outOfStock} drug(s) are out of stock — reorder soon.</li>}
            {lowStock > 0 && <li>• {lowStock} drug(s) are running low.</li>}
            {expiredDrugs > 0 && (
              <li>• {expiredDrugs} drug(s) have expired stock that cannot be sold.</li>
            )}
          </ul>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-medium text-gray-900">Recent sales</h3>
          <Link href="/reports" className="text-sm text-brand-600 hover:underline">
            View reports →
          </Link>
        </div>
        {recentSales.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No sales yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentSales.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium text-gray-900">{s.serial}</span>
                  <span className="ml-2 text-gray-400">
                    {s._count.items} item(s) ·{" "}
                    {s.soldBy ? `${s.soldBy.firstName}` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">
                    {s.createdAt.toLocaleDateString()}
                  </span>
                  <Badge tone="blue">{formatMoney(s.total)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
