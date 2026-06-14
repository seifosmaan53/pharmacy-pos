"use client";

import { useActionState, useEffect } from "react";
import { Input, Select } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/modal";
import { createStaff, updateStaff, type FormState } from "./actions";

type Staff = {
  id: string;
  pfno: string;
  firstName: string;
  lastName: string;
  role: "MANAGER" | "PHARMACIST";
  phone: string | null;
  email: string | null;
  gender: string | null;
};

function InnerForm({
  staff,
  action,
  close,
}: {
  staff?: Staff;
  action: (s: FormState, f: FormData) => Promise<FormState>;
  close: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);

  return (
    <form action={formAction} className="space-y-4">
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" name="firstName" defaultValue={staff?.firstName} required />
        <Input label="Last name" name="lastName" defaultValue={staff?.lastName} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Staff number (pfno)" name="pfno" defaultValue={staff?.pfno} required />
        <Select label="Role" name="role" defaultValue={staff?.role ?? "PHARMACIST"}>
          <option value="PHARMACIST">Pharmacist</option>
          <option value="MANAGER">Manager</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Phone" name="phone" defaultValue={staff?.phone ?? ""} />
        <Select label="Gender" name="gender" defaultValue={staff?.gender ?? ""}>
          <option value="">—</option>
          <option>Male</option>
          <option>Female</option>
        </Select>
      </div>
      <Input label="Email" name="email" type="email" defaultValue={staff?.email ?? ""} />
      <Input
        label={staff ? "New password (leave blank to keep)" : "Password"}
        name="password"
        type="password"
        required={!staff}
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton pending={pending}>
        {staff ? "Save changes" : "Add staff"}
      </SubmitButton>
    </form>
  );
}

export function AddStaffButton() {
  return (
    <Modal
      title="Add staff member"
      trigger={
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Add staff
        </button>
      }
    >
      {(close) => <InnerForm action={createStaff} close={close} />}
    </Modal>
  );
}

export function EditStaffButton({ staff }: { staff: Staff }) {
  return (
    <Modal
      title="Edit staff member"
      trigger={
        <button className="text-sm font-medium text-brand-600 hover:underline">
          Edit
        </button>
      }
    >
      {(close) => <InnerForm staff={staff} action={updateStaff} close={close} />}
    </Modal>
  );
}
