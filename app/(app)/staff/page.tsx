import { requireManager } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Card,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
} from "@/components/ui";
import { AddStaffButton, EditStaffButton } from "./staff-form";
import { toggleStaffActive } from "./actions";

export default async function StaffPage() {
  const me = await requireManager();
  const staff = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Manage who can use the system"
        action={<AddStaffButton />}
      />
      <Card>
        {staff.length === 0 ? (
          <EmptyState message="No staff yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Staff no.</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium text-gray-900">
                    {u.firstName} {u.lastName}
                    {u.id === me.id && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                  </Td>
                  <Td>{u.pfno}</Td>
                  <Td>
                    <Badge tone={u.role === "MANAGER" ? "blue" : "gray"}>
                      {u.role === "MANAGER" ? "Manager" : "Pharmacist"}
                    </Badge>
                  </Td>
                  <Td>
                    {u.active ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="red">Disabled</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <EditStaffButton staff={u} />
                      {u.id !== me.id && (
                        <form action={toggleStaffActive} className="inline">
                          <input type="hidden" name="id" value={u.id} />
                          <button className="text-sm font-medium text-gray-500 hover:underline">
                            {u.active ? "Disable" : "Enable"}
                          </button>
                        </form>
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
