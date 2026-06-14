import { requireUser } from "@/lib/guards";
import { listSellableDrugs } from "@/lib/inventory";
import { PageHeader } from "@/components/ui";
import { PosTerminal } from "./pos-terminal";

export default async function PosPage() {
  await requireUser();
  const drugs = await listSellableDrugs();

  return (
    <>
      <PageHeader title="Point of Sale" subtitle="Sell drugs to customers" />
      <PosTerminal
        drugs={drugs.map((d) => ({
          id: d.id,
          name: d.name,
          unit: d.unit,
          price: d.price,
          available: d.available,
        }))}
      />
    </>
  );
}
