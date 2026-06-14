import { requireManager } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Card,
  Table,
  Th,
  Td,
  EmptyState,
} from "@/components/ui";
import { AddSupplierButton, EditSupplierButton } from "./supplier-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteSupplier } from "./actions";

export default async function SuppliersPage() {
  await requireManager();
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { stocks: true } } },
  });

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="Companies you buy stock from"
        action={<AddSupplierButton />}
      />
      <Card>
        {suppliers.length === 0 ? (
          <EmptyState message="No suppliers yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Location</Th>
                <Th>Batches</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium text-gray-900">{s.name}</Td>
                  <Td>{s.phone}</Td>
                  <Td className="text-gray-500">{s.location ?? "—"}</Td>
                  <Td>{s._count.stocks}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-3">
                      <EditSupplierButton supplier={s} />
                      {s._count.stocks === 0 && (
                        <DeleteButton
                          id={s.id}
                          action={deleteSupplier}
                          confirmMessage={`Delete ${s.name}?`}
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
