"use client";

import { useActionState, useEffect } from "react";
import { Input, Select } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/modal";
import { createDrug, updateDrug, type FormState } from "./actions";
import { fromCents } from "@/lib/money";

type Drug = {
  id: string;
  name: string;
  form: string;
  unit: string;
  price: number;
};

const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Powder", "Cream", "Drops"];

function Fields({
  drug,
  action,
  trigger,
  title,
}: {
  drug?: Drug;
  action: (s: FormState, f: FormData) => Promise<FormState>;
  trigger: React.ReactNode;
  title: string;
}) {
  return (
    <Modal trigger={trigger} title={title}>
      {(close) => <InnerForm drug={drug} action={action} close={close} />}
    </Modal>
  );
}

function InnerForm({
  drug,
  action,
  close,
}: {
  drug?: Drug;
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
      {drug && <input type="hidden" name="id" value={drug.id} />}
      <Input label="Drug name" name="name" defaultValue={drug?.name} required />
      <Select label="Form" name="form" defaultValue={drug?.form ?? "Tablet"}>
        {FORMS.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </Select>
      <Input
        label="Unit (e.g. pcs, ml, mg)"
        name="unit"
        defaultValue={drug?.unit ?? "pcs"}
        required
      />
      <Input
        label="Selling price"
        name="price"
        type="number"
        step="0.01"
        min="0"
        defaultValue={drug ? fromCents(drug.price) : ""}
        required
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton pending={pending}>
        {drug ? "Save changes" : "Add drug"}
      </SubmitButton>
    </form>
  );
}

export function AddDrugButton() {
  return (
    <Fields
      action={createDrug}
      title="Add drug"
      trigger={
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Add drug
        </button>
      }
    />
  );
}

export function EditDrugButton({ drug }: { drug: Drug }) {
  return (
    <Fields
      drug={drug}
      action={updateDrug}
      title="Edit drug"
      trigger={
        <button className="text-sm font-medium text-brand-600 hover:underline">
          Edit
        </button>
      }
    />
  );
}
