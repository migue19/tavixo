import { Branding } from "./branding";
import PDFDocument from "pdfkit";
import { resolve as assetPath } from "node:path";
import { IsEnum } from "class-validator";
const regular = assetPath(
  __dirname,
  "../assets/fonts/LiberationSans-Regular.ttf",
);
const boldFont = assetPath(__dirname, "../assets/fonts/LiberationSans-Bold.ttf");
export enum TicketKind {
  ACCOUNT = "ACCOUNT",
  PAYMENT = "PAYMENT",
}
export class TicketQuery {
  @IsEnum(TicketKind) kind: TicketKind = TicketKind.ACCOUNT;
}
export type Ticket = {
  kind: TicketKind;
  title: string;
  notice: string;
  restaurant: string;
  branding?: Branding | null;
  branch: string;
  address: string;
  order: {
    id: string;
    number: number;
    tableName: string;
    createdAt: string;
    createdByName: string;
    totalCents: number;
    items: {
      name: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }[];
  };
  payment: null | {
    id: string;
    method: string;
    amountCents: number;
    cashAmountCents: number;
    cardAmountCents: number;
    receivedCents: number;
    changeCents: number;
    reference: string;
    actorName: string;
    createdAt: string;
  };
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
const date = (s: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(s));
export function ticketPdf(ticket: Ticket): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [226.77, 595.28],
      font: regular,
      margins: { top: 14, right: 14, left: 14, bottom: 26 },
      info: {
        Title: `${ticket.title} #${ticket.order.number}`,
        Author: ticket.restaurant,
      },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const text = (s: string, size = 9, bold = false) => {
      doc
        .font(bold ? boldFont : regular)
        .fontSize(size)
        .text(s, { width: 198.77, lineGap: 3 });
    };
    try {
      // Select the bundled image by identity, never by a supplied filesystem path.
      if (ticket.branding?.key === "birria-el-cachanilla") {
        doc.image(assetPath(__dirname, "../assets/branding/birria-el-cachanilla.jpg"), 77, doc.y, { width: 72 });
        doc.y += 82;
        doc.moveTo(14, doc.y).lineTo(212, doc.y).strokeColor("#d4a466").stroke();
        doc.y += 10;
      }
      text(ticket.restaurant, 14, true);
      text(ticket.branch, 10, true);
      if (ticket.address) text(ticket.address);
      doc.moveDown();
      text(ticket.title.toUpperCase(), 11, true);
      text(ticket.notice, 9, true);
      text(`Cuenta #${ticket.order.number} · ${ticket.order.tableName}`);
      text(`Pedido: ${date(ticket.order.createdAt)}`);
      text(`Atendió: ${ticket.order.createdByName}`);
      doc.moveDown();
      for (const i of ticket.order.items) {
        const name = `${i.quantity} × ${i.name}`;
        const detail = `${money(i.unitPriceCents)} c/u · ${money(i.lineTotalCents)}`;
        const nameHeight = doc
          .font(boldFont)
          .fontSize(10)
          .heightOfString(name, { width: 198.77, lineGap: 3 });
        const detailHeight = doc
          .font(regular)
          .fontSize(9)
          .heightOfString(detail, { width: 198.77, lineGap: 3 });
        if (doc.y + nameHeight + detailHeight + 8 > doc.page.height - 26) {
          doc.addPage();
          text(`Cuenta #${ticket.order.number} · continuación`, 8, true);
          doc.moveDown();
        }
        text(name, 10, true);
        text(`${money(i.unitPriceCents)} c/u · ${money(i.lineTotalCents)}`);
        doc.moveDown(0.4);
      }
      doc.moveDown();
      text(`TOTAL MXN: ${money(ticket.order.totalCents)}`, 12, true);
      if (ticket.payment) {
        const p = ticket.payment;
        doc.moveDown();
        text(
          `Pago: ${p.method === "CASH" ? "Efectivo" : p.method === "MIXED" ? "Mixto" : "Tarjeta"}`,
          10,
          true,
        );
        text(`Pagado: ${money(p.amountCents)}`);
        if (p.method === "MIXED") {
          text(`Efectivo: ${money(p.cashAmountCents)}`);
          text(`Tarjeta: ${money(p.cardAmountCents)}`);
        }
        if (p.method !== "CARD") {
          text(
            `Recibido: ${money(p.method === "MIXED" ? p.receivedCents - p.cardAmountCents : p.receivedCents)}`,
          );
          text(`Cambio: ${money(p.changeCents)}`);
        }
        if (p.reference) text(`Folio terminal: ${p.reference}`);
        text(`Registró: ${p.actorName}`);
        text(`Pago: ${date(p.createdAt)}`);
        text(`Referencia de pago: ${p.id}`, 7);
      }
      doc.moveDown();
      text(`Referencia de cuenta: ${ticket.order.id}`, 7);
      text("Tecnología Tavixo · Ticket digital", 8);
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        doc
          .font(regular)
          .fontSize(7)
          .text(`Página ${i + 1} de ${pages.count}`, 14, doc.page.height - 12, {
            lineBreak: false,
          });
      }
      doc.end();
    } catch (e) {
      doc.destroy();
      reject(e);
    }
  });
}
