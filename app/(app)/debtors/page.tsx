import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { listSellableDrugs } from "@/lib/inventory";
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
import { AddDebtorButton, RepayButton } from "./debtor-forms";

export default async function DebtorsPage() {
  await requireUser();
  const [debtors, drugs] = await Promise.all([
    prisma.debtor.findMany({ orderBy: { createdAt: "desc" } }),
    listSellableDrugs(),
  ]);

  const active = debtors.filter((d) => !d.settled);
  const settled = debtors.filter((d) => d.settled);
  const totalOutstanding = active.reduce(
    (s, d) => s + (d.amountOwed - d.deposit),
    0,
  );

  return (
    <>
      <PageHeader
        title="Debtors"
        subtitle={`${active.length} active · ${formatMoney(totalOutstanding)} outstanding`}
        action={
          <AddDebtorButton
            drugs={drugs.map((d) => ({
              id: d.id,
              name: d.name,
              available: d.available,
              unit: d.unit,
              price: d.price,
            }))}
          />
        }
      />

      <Card className="mb-6">
        <div className="border-b border-gray-100 px-4 py-3 font-medium text-gray-900">
          Active debtors
        </div>
        {active.length === 0 ? (
          <EmptyState message="No outstanding debts. 🎉" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Drug</Th>
                <Th>Owed</Th>
                <Th>Paid</Th>
                <Th>Balance</Th>
                <Th>Due</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((d) => {
                const balance = d.amountOwed - d.deposit;
                const overdue = d.dueDate && d.dueDate < new Date();
                return (
                  <tr key={d.id}>
                    <Td className="font-medium text-gray-900">
                      {d.name}
                      <span className="block text-xs text-gray-400">{d.phone}</span>
                    </Td>
                    <Td className="text-gray-500">
                      {d.drugName} × {d.quantity}
                    </Td>
                    <Td>{formatMoney(d.amountOwed)}</Td>
                    <Td>{formatMoney(d.deposit)}</Td>
                    <Td className="font-medium text-red-600">{formatMoney(balance)}</Td>
                    <Td>
                      {d.dueDate ? (
                        overdue ? (
                          <Badge tone="red">
                            {d.dueDate.toLocaleDateString()}
                          </Badge>
                        ) : (
                          d.dueDate.toLocaleDateString()
                        )
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right">
                      <RepayButton id={d.id} outstanding={balance} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {settled.length > 0 && (
        <Card>
          <div className="border-b border-gray-100 px-4 py-3 font-medium text-gray-900">
            Settled
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Drug</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {settled.map((d) => (
                <tr key={d.id}>
                  <Td className="font-medium text-gray-900">{d.name}</Td>
                  <Td className="text-gray-500">
                    {d.drugName} × {d.quantity}
                  </Td>
                  <Td>{formatMoney(d.amountOwed)}</Td>
                  <Td>
                    <Badge tone="green">Paid</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
