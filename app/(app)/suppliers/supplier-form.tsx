"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/modal";
import { createSupplier, updateSupplier, type FormState } from "./actions";

type Supplier = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  location: string | null;
};

function InnerForm({
  supplier,
  action,
  close,
}: {
  supplier?: Supplier;
  action: (s: FormState, f: FormData) => Promise<FormState>;
  close: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);

  return (
    <form action={formAction} className="space-y-4">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <Input label="Name" name="name" defaultValue={supplier?.name} required />
      <Input label="Phone" name="phone" defaultValue={supplier?.phone} required />
      <Input label="Address" name="address" defaultValue={supplier?.address ?? ""} />
      <Input label="Location" name="location" defaultValue={supplier?.location ?? ""} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton pending={pending}>
        {supplier ? "Save changes" : "Add supplier"}
      </SubmitButton>
    </form>
  );
}

export function AddSupplierButton() {
  return (
    <Modal
      title="Add supplier"
      trigger={
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Add supplier
        </button>
      }
    >
      {(close) => <InnerForm action={createSupplier} close={close} />}
    </Modal>
  );
}

export function EditSupplierButton({ supplier }: { supplier: Supplier }) {
  return (
    <Modal
      title="Edit supplier"
      trigger={
        <button className="text-sm font-medium text-brand-600 hover:underline">
          Edit
        </button>
      }
    >
      {(close) => (
        <InnerForm supplier={supplier} action={updateSupplier} close={close} />
      )}
    </Modal>
  );
}
