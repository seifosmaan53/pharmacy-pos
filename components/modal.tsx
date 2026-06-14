"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./ui";

/**
 * A reusable trigger + dialog. The form inside calls a server action; when the
 * action returns successfully it resets and we close. We detect "success" by
 * the form's own onSubmit transition completing without a thrown error — here we
 * keep it simple: the caller passes `closeSignal` (e.g. a key derived from
 * state) or we close on successful native submit via a small heuristic.
 */
export function Modal({
  trigger,
  title,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === dialogRef.current) setOpen(false);
          }}
          ref={dialogRef}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-5">{children(() => setOpen(false))}</div>
          </div>
        </div>
      )}
    </>
  );
}

/** Submit button that reflects a pending state from useActionState. */
export function SubmitButton({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : children}
    </Button>
  );
}
