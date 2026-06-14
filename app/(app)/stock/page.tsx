import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import {
  PageHeader,
  Card,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
} from "@/components/ui";
import { AddStockButton } from "./stock-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteStock } from "./actions";

const SOON_DAYS = 30;

function batchStatus(expiry: Date, remaining: number) {
  const now = Date.now();
  if (remaining <= 0) return <Badge tone="gray">Depleted</Badge>;
  if (expiry.getTime() <= now) return <Badge tone="red">Expired</Badge>;
  if (expiry.getTime() <= now + SOON_DAYS * 86_400_000)
    return <Badge tone="amber">Expiring soon</Badge>;
  return <Badge tone="green">Good</Badge>;
}

export default async function StockPage() {
  const user = await requireUser();
  const [batches, drugs, suppliers] = await Promise.all([
    prisma.stock.findMany({
      orderBy: { expiryDate: "asc" },
      include: { drug: true, supplier: true },
    }),
    prisma.drug.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Received batches, sold first-expiry-first (FEFO)"
        action={<AddStockButton drugs={drugs} suppliers={suppliers} />}
      />
      <Card>
        {batches.length === 0 ? (
          <EmptyState message="No stock received yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Drug</Th>
                <Th>Batch</Th>
                <Th>Supplier</Th>
                <Th>Remaining / Received</Th>
                <Th>Selling price</Th>
                <Th>Expiry</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium text-gray-900">{b.drug.name}</Td>
                  <Td className="text-gray-500">{b.batchNo ?? "—"}</Td>
                  <Td className="text-gray-500">{b.supplier.name}</Td>
                  <Td>
                    {b.remaining} / {b.quantity}
                  </Td>
                  <Td>{formatMoney(b.sellingPrice)}</Td>
                  <Td className="text-gray-500">
                    {b.expiryDate.toLocaleDateString()}
                  </Td>
                  <Td>{batchStatus(b.expiryDate, b.remaining)}</Td>
                  <Td className="text-right">
                    {user.role === "MANAGER" && (
                      <DeleteButton
                        id={b.id}
                        action={deleteStock}
                        confirmMessage="Delete this batch?"
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
