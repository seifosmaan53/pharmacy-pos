import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/money";

// Generates a real PDF receipt (80mm thermal-printer width) for a sale.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, soldBy: true },
  });
  if (!sale) return new Response("Not found", { status: 404 });

  const W = 226; // ~80mm in points
  const margin = 14;
  const lineH = 13;
  // Height grows with the number of items.
  const H = 200 + sale.items.length * lineH;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.4, 0.4, 0.4);

  let y = H - margin;

  const center = (text: string, f = font, size = 9, color = rgb(0, 0, 0)) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (W - w) / 2, y, size, font: f, color });
    y -= size + 4;
  };
  const row = (left: string, right: string, f = font, size = 8) => {
    page.drawText(left, { x: margin, y, size, font: f });
    const rw = f.widthOfTextAtSize(right, size);
    page.drawText(right, { x: W - margin - rw, y, size, font: f });
    y -= lineH;
  };
  const rule = () => {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: W - margin, y: y + 4 },
      thickness: 0.5,
      color: gray,
    });
    y -= 8;
  };
  const small = (text: string) => {
    page.drawText(text, { x: margin, y, size: 7, font, color: gray });
    y -= 11;
  };

  center("PHARMACY POS", bold, 13);
  center("Sales Receipt", font, 8, gray);
  y -= 2;
  small(`No:   ${sale.serial}`);
  small(`Date: ${sale.createdAt.toLocaleString()}`);
  small(`By:   ${sale.soldBy ? `${sale.soldBy.firstName} ${sale.soldBy.lastName}` : "—"}`);
  y -= 2;
  rule();

  for (const it of sale.items) {
    row(
      `${truncate(it.drugName, 22)} x${it.quantity}`,
      formatMoney(it.price * it.quantity),
    );
  }

  rule();
  row("Total", formatMoney(sale.total), bold, 9);
  row("Paid", formatMoney(sale.paid));
  if (sale.discount > 0) row("Discount", formatMoney(sale.discount));
  row(
    sale.balance >= 0 ? "Change" : "Balance due",
    formatMoney(Math.abs(sale.balance)),
    bold,
    9,
  );
  y -= 6;
  center("Thank you! Get well soon.", font, 7, gray);

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${sale.serial}.pdf"`,
    },
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
