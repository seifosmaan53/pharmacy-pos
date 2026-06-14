"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, toCents } from "@/lib/money";
import { Card, Input, Button, Badge } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { completeSale, type Receipt } from "./actions";

type Drug = {
  id: string;
  name: string;
  unit: string;
  price: number; // cents
  available: number;
};

type CartLine = {
  drugId: string;
  name: string;
  unit: string;
  price: number; // cents
  available: number;
  qty: number;
};

export function PosTerminal({ drugs }: { drugs: Drug[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mode, setMode] = useState<"qty" | "cash">("qty");
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState(""); // qty or cash amount, depending on mode
  const [selected, setSelected] = useState<Drug | null>(null);
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? drugs.filter((d) => d.name.toLowerCase().includes(q)) : drugs;
  }, [drugs, search]);

  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const balance =
    (paid ? toCents(Number(paid)) : 0) +
    (discount ? toCents(Number(discount)) : 0) -
    total;

  function inCart(drugId: string) {
    return cart.find((l) => l.drugId === drugId)?.qty ?? 0;
  }

  function addToCart() {
    setError(null);
    if (!selected) {
      setError("Select a drug first.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid number.");
      return;
    }

    if (selected.price <= 0) {
      setError(`${selected.name} has no price set.`);
      return;
    }

    let qty: number;
    if (mode === "qty") {
      qty = Math.floor(value);
    } else {
      // Cash sale: how many whole units does this amount buy?
      qty = Math.floor(toCents(value) / selected.price);
      if (qty <= 0) {
        setError(`Amount too low — one ${selected.name} costs ${formatMoney(selected.price)}.`);
        return;
      }
    }

    const remaining = selected.available - inCart(selected.id);
    if (qty > remaining) {
      setError(`Only ${remaining} ${selected.unit} of ${selected.name} available.`);
      return;
    }

    // In cash mode, the amount handed over is the payment — record it so the
    // leftover becomes change, not a silent loss.
    if (mode === "cash") {
      setPaid((p) => String((Number(p) || 0) + value));
    }

    setCart((prev) => {
      const existing = prev.find((l) => l.drugId === selected.id);
      if (existing) {
        return prev.map((l) =>
          l.drugId === selected.id ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [
        ...prev,
        {
          drugId: selected.id,
          name: selected.name,
          unit: selected.unit,
          price: selected.price,
          available: selected.available,
          qty,
        },
      ];
    });
    setAmount("");
  }

  function removeLine(drugId: string) {
    setCart((prev) => prev.filter((l) => l.drugId !== drugId));
  }

  function finalize() {
    setError(null);
    if (cart.length === 0) {
      setError("Cart is empty.");
      return;
    }
    const discountCents = discount ? toCents(Number(discount)) : 0;
    if (discountCents > total) {
      setError("Discount cannot be greater than the total.");
      return;
    }
    startTransition(async () => {
      const res = await completeSale({
        items: cart.map((l) => ({ drugId: l.drugId, qty: l.qty })),
        paid: paid ? Number(paid) : 0,
        discount: discount ? Number(discount) : 0,
      });
      if (res.ok) {
        setReceipt(res.receipt);
        setCart([]);
        setPaid("");
        setDiscount("");
        setSelected(null);
        // Pull fresh stock levels so the picker reflects what was just sold.
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left: drug picker + cart */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setMode("qty")}
              className={clsx(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium",
                mode === "qty" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600",
              )}
            >
              Quantity sale
            </button>
            <button
              onClick={() => setMode("cash")}
              className={clsx(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium",
                mode === "cash" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600",
              )}
            >
              Cash sale
            </button>
          </div>

          <Input
            placeholder="Search drug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />

          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">No sellable drugs.</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className={clsx(
                    "flex w-full items-center justify-between border-b border-gray-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50",
                    selected?.id === d.id && "bg-brand-50",
                  )}
                >
                  <span className="font-medium text-gray-800">{d.name}</span>
                  <span className="flex items-center gap-2 text-gray-500">
                    {formatMoney(d.price)}
                    <Badge tone={d.available <= 10 ? "amber" : "green"}>
                      {d.available} {d.unit}
                    </Badge>
                  </span>
                </button>
              ))
            )}
          </div>

          {selected && (
            <div className="mt-3 flex items-end gap-2">
              <Input
                label={
                  mode === "qty"
                    ? `Quantity of ${selected.name}`
                    : `Cash amount for ${selected.name}`
                }
                type="number"
                min="0"
                step={mode === "qty" ? "1" : "0.01"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToCart()}
              />
              <Button onClick={addToCart}>Add</Button>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-medium text-gray-900">Cart</h3>
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No items yet. Pick a drug above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.drugId} className="border-t border-gray-50">
                    <td className="py-2">
                      {l.name}
                      <span className="block text-xs text-gray-400">
                        {formatMoney(l.price)} / {l.unit}
                      </span>
                    </td>
                    <td className="py-2">
                      {l.qty} {l.unit}
                    </td>
                    <td className="py-2 text-right">{formatMoney(l.price * l.qty)}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => removeLine(l.drugId)}
                        className="text-red-500 hover:underline"
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Right: payment */}
      <div>
        <Card className="sticky top-6 space-y-4 p-5">
          <div className="flex items-center justify-between text-lg">
            <span className="text-gray-500">Total</span>
            <span className="font-semibold text-gray-900">{formatMoney(total)}</span>
          </div>
          <Input
            label="Amount paid"
            type="number"
            min="0"
            step="0.01"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
          <Input
            label="Discount"
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-gray-500">
              {balance >= 0 ? "Change" : "Balance due"}
            </span>
            <span
              className={clsx(
                "font-semibold",
                balance >= 0 ? "text-green-600" : "text-red-600",
              )}
            >
              {formatMoney(Math.abs(balance))}
            </span>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setCart([]);
                setPaid("");
                setDiscount("");
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={finalize} disabled={pending}>
              {pending ? "Selling…" : "Complete sale"}
            </Button>
          </div>
        </Card>
      </div>

      {receipt && (
        <ReceiptOverlay receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}

function ReceiptOverlay({
  receipt,
  onClose,
}: {
  receipt: Receipt;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="print-area px-6 py-5 font-mono text-sm text-gray-800">
          <div className="mb-3 text-center">
            <div className="text-lg font-bold">💊 Pharmacy POS</div>
            <div className="text-xs text-gray-500">Sales Receipt</div>
          </div>
          <div className="mb-2 text-xs">
            <div>No: {receipt.serial}</div>
            <div>{receipt.date}</div>
            <div>Served by: {receipt.cashier}</div>
          </div>
          <div className="border-t border-dashed border-gray-300 py-2">
            {receipt.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {it.name} × {it.qty}
                </span>
                <span>{formatMoney(it.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-dashed border-gray-300 pt-2">
            <Row label="Total" value={formatMoney(receipt.total)} bold />
            <Row label="Paid" value={formatMoney(receipt.paid)} />
            {receipt.discount > 0 && (
              <Row label="Discount" value={formatMoney(receipt.discount)} />
            )}
            <Row
              label={receipt.balance >= 0 ? "Change" : "Balance due"}
              value={formatMoney(Math.abs(receipt.balance))}
            />
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            Thank you! Get well soon.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2 border-t border-gray-100 p-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <a
            href={`/api/receipt/${receipt.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            ⬇ PDF
          </a>
          <Button className="flex-1" onClick={() => window.print()}>
            🖨 Print
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={clsx("flex justify-between", bold && "font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
