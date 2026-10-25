import { requireUser } from "@/lib/guards";
import { listDrugsWithStock, LOW_STOCK_THRESHOLD } from "@/lib/inventory";
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
import { AddDrugButton, EditDrugButton } from "./drug-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteDrug } from "./actions";

function expiryBadge(d: { available: number; nearestExpiry: Date | null; expiredQty: number }) {
  if (d.available <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (d.available <= LOW_STOCK_THRESHOLD) return <Badge tone="amber">Low stock</Badge>;
  return <Badge tone="green">In stock</Badge>;
}

export default async function DrugsPage() {
  const user = await requireUser();
  const drugs = await listDrugsWithStock();
  const isManager = user.role === "MANAGER";

  return (
    <>
      <PageHeader
        title="Drugs"
        subtitle="Your medicine catalog and live stock levels"
        action={isManager ? <AddDrugButton /> : undefined}
      />
      <Card>
        {drugs.length === 0 ? (
          <EmptyState
            message={
              isManager
                ? "No drugs yet. Add your first drug to get started."
                : "No drugs yet. A manager adds drugs to the catalog."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Form</Th>
                <Th>Price</Th>
                <Th>Available</Th>
                <Th>Status</Th>
                <Th>Nearest expiry</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {drugs.map((d) => (
                <tr key={d.id}>
                  <Td className="font-medium text-gray-900">{d.name}</Td>
                  <Td className="text-gray-500">{d.form}</Td>
                  <Td>{formatMoney(d.price)}</Td>
                  <Td>
                    {d.available} {d.unit}
                    {d.expiredQty > 0 && (
                      <span className="ml-2 text-xs text-red-500">
                        ({d.expiredQty} expired)
                      </span>
                    )}
                  </Td>
                  <Td>{expiryBadge(d)}</Td>
                  <Td className="text-gray-500">
                    {d.nearestExpiry
                      ? d.nearestExpiry.toLocaleDateString()
                      : "—"}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-3">
                      {isManager && <EditDrugButton drug={d} />}
                      {isManager && d.available <= 0 && (
                        <DeleteButton
                          id={d.id}
                          action={deleteDrug}
                          confirmMessage={`Delete ${d.name}? This also removes its (depleted/expired) stock history.`}
                        />
                      )}
                    </div>
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
