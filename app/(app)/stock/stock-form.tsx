"use client";

import { useActionState, useEffect } from "react";
import { Input, Select } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/modal";
import { createStock, type FormState } from "./actions";

type Option = { id: string; name: string };

function InnerForm({
  drugs,
  suppliers,
  close,
}: {
  drugs: Option[];
  suppliers: Option[];
  close: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStock,
    {},
  );
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);

  return (
    <form action={formAction} className="space-y-4">
      <Select label="Drug" name="drugId" required defaultValue="">
        <option value="" disabled>
          Select drug…
        </option>
        {drugs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <Select label="Supplier" name="supplierId" required defaultValue="">
        <option value="" disabled>
          Select supplier…
        </option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantity" name="quantity" type="number" min="1" required />
        <Input label="Batch no." name="batchNo" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Buying price"
          name="buyingPrice"
          type="number"
          step="0.01"
          min="0"
          required
        />
        <Input
          label="Selling price"
          name="sellingPrice"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>
      <Input label="Expiry date" name="expiryDate" type="date" required />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton pending={pending}>Receive stock</SubmitButton>
    </form>
  );
}

export function AddStockButton({
  drugs,
  suppliers,
}: {
  drugs: Option[];
  suppliers: Option[];
}) {
  const disabled = drugs.length === 0 || suppliers.length === 0;
  return (
    <Modal
      title="Receive stock"
      trigger={
        <button
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          disabled={disabled}
          title={disabled ? "Add a drug and a supplier first" : undefined}
        >
          + Receive stock
        </button>
      }
    >
      {(close) => (
        <InnerForm drugs={drugs} suppliers={suppliers} close={close} />
      )}
    </Modal>
  );
}
