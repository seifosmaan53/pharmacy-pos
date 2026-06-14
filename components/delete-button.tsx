"use client";

type Props = {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
  confirmMessage?: string;
};

export function DeleteButton({ id, action, label = "Delete", confirmMessage }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage ?? "Delete this item? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-sm font-medium text-red-600 hover:underline">
        {label}
      </button>
    </form>
  );
}
