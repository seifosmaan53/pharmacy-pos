"use client";

import { useActionState, useEffect } from "react";
import { Input, Select } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/modal";
import { addDebtor, repayDebtor, type FormState } from "./actions";
import { formatMoney } from "@/lib/money";

type Drug = { id: string; name: string; available: number; unit: string; price: number };

function AddForm({ drugs, close }: { drugs: Drug[]; close: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addDebtor,
    {},
  );
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Customer name" name="name" required />
      <Input label="Phone" name="phone" required />
      <Select label="Drug" name="drugId" required defaultValue="">
        <option value="" disabled>
          Select drug…
        </option>
        {drugs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} — {d.available} {d.unit} @ {formatMoney(d.price)}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantity" name="quantity" type="number" min="1" required />
        <Input label="Deposit paid" name="deposit" type="number" min="0" step="0.01" defaultValue="0" />
      </div>
      <Input label="Due date" name="dueDate" type="date" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton pending={pending}>Add debtor</SubmitButton>
    </form>
  );
}

export function AddDebtorButton({ drugs }: { drugs: Drug[] }) {
  return (
    <Modal
      title="Add debtor (credit sale)"
      trigger={
        <button
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          disabled={drugs.length === 0}
        >
          + Add debtor
        </button>
      }
    >
      {(close) => <AddForm drugs={drugs} close={close} />}
    </Modal>
  );
}

function RepayForm({
  id,
  outstanding,
  close,
}: {
  id: string;
  outstanding: number;
  close: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    repayDebtor,
    {},
  );
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-gray-500">
        Outstanding balance:{" "}
        <span className="font-semibold text-gray-900">{formatMoney(outstanding)}</span>
      </p>
      <Input label="Repayment amount" name="amount" type="number" min="0" step="0.01" required />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton pending={pending}>Record repayment</SubmitButton>
    </form>
  );
}

export function RepayButton({
  id,
  outstanding,
}: {
  id: string;
  outstanding: number;
}) {
  return (
    <Modal
      title="Record repayment"
      trigger={
        <button className="text-sm font-medium text-brand-600 hover:underline">
          Repay
        </button>
      }
    >
      {(close) => <RepayForm id={id} outstanding={outstanding} close={close} />}
    </Modal>
  );
}
