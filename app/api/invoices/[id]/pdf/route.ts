import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { invoiceBalance } from "@/server/finance";
import { errorResponse, requireActor } from "@/server/http";
import { formatInr } from "@/server/money";
import { assertPermission } from "@/server/permissions";
import { invoicePdf } from "@/server/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const actor = requireActor(request);
    assertPermission(actor, "invoice:view");
    const db = getDb();
    const business = db.prepare(`SELECT ecommerce_billing, name, gstin FROM businesses WHERE id = ?`).get(actor.businessId) as {
      ecommerce_billing: number;
      name: string;
      gstin: string | null;
    };
    if (!business.ecommerce_billing) throw new AppError(403, "BILLING_DISABLED", "Invoices are available only for e-commerce businesses");
    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ? AND business_id = ?`).get(context.params.id, actor.businessId) as
      | {
          id: string;
          number: string;
          subtotal_paise: number;
          discount_paise: number;
          shipping_paise: number;
          tax_paise: number;
          total_paise: number;
          currency: string;
          issued_at: string;
        }
      | undefined;
    if (!invoice) throw new AppError(404, "NOT_FOUND", "Invoice not found");
    const items = db.prepare(`SELECT name, quantity_milli, unit_paise, line_paise FROM invoice_items WHERE invoice_id = ?`).all(invoice.id) as Array<{
      name: string;
      quantity_milli: number;
      line_paise: number;
    }>;
    const balance = invoiceBalance(db, actor.businessId, invoice.id);
    const pdf = invoicePdf([
      business.name,
      business.gstin ? `GSTIN ${business.gstin}` : "GSTIN not set",
      invoice.number,
      invoice.issued_at,
      ...items.map((item) => `${item.name} x ${item.quantity_milli / 1000} ${formatInr(item.line_paise)}`),
      `Subtotal ${formatInr(invoice.subtotal_paise)}`,
      `Discount ${formatInr(invoice.discount_paise)}`,
      `Shipping ${formatInr(invoice.shipping_paise)}`,
      `Tax ${formatInr(invoice.tax_paise)}`,
      `Total ${formatInr(invoice.total_paise)} ${invoice.currency}`,
      `Book due ${formatInr(balance.bookDuePaise)}`,
      `Bank settled ${formatInr(balance.bankSettledPaise)}`,
      "Tax shown is a configured calculation, not a filing.",
    ]);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${invoice.number}.pdf"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
