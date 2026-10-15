"use client";
import { useEffect, useRef, useState } from "react";
import type { Branding } from "./branding";
import type { Order } from "./orders";
type Kind = "ACCOUNT" | "PAYMENT";
type Ticket = {
  kind: Kind;
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
export default function TicketPanel({
  order,
  branchId,
  token,
  disabled,
}: {
  order: Order;
  branchId: string;
  token: string;
  disabled: boolean;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setTicket(null);
    setBusy(false);
    setError("");
    return () => {
      generation.current++;
    };
  }, [
    order.id,
    order.status,
    order.payment?.id,
    order.totalCents,
    order.items.length,
    order.items.reduce((n, i) => n + i.cancelledQuantity, 0),
  ]);
  async function request(kind: Kind, pdf = false) {
    const res = await fetch(
      `/api/restaurant/branches/${branchId}/orders/${order.id}/ticket${pdf ? ".pdf" : ""}?kind=${kind}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      const value = await res.json();
      throw new Error(
        Array.isArray(value.message)
          ? "Revisa el tipo de ticket"
          : (value.message ?? "No se pudo generar el ticket"),
      );
    }
    return res;
  }
  async function show(kind: Kind) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setTicket(null);
    try {
      const value: Ticket = await (await request(kind)).json();
      if (generation.current === current) setTicket(value);
    } catch (e) {
      if (generation.current === current)
        setError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  async function download() {
    if (!ticket) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      const res = await request(ticket.kind, true);
      const blob = await res.blob();
      if (generation.current !== current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tavixo-${ticket.kind.toLowerCase()}-${ticket.order.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      if (generation.current === current)
        setError(
          e instanceof Error ? e.message : "No se pudo descargar el PDF",
        );
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  if (order.status === "CANCELLED") return null;
  return (
    <section className="ticket-panel" aria-label="Tickets digitales">
      <div className="actions">
        <button
          className="secondary"
          disabled={disabled || busy}
          onClick={() => show("ACCOUNT")}
        >
          Ver cuenta digital
        </button>
        {order.payment && (
          <button
            className="secondary"
            disabled={disabled || busy}
            onClick={() => show("PAYMENT")}
          >
            Ver comprobante de pago
          </button>
        )}
      </div>
      {busy && <p role="status">Preparando ticket…</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {ticket && (
        <>
          <article
            className="digital-ticket"
            aria-label="Vista previa del ticket"
          >
            {ticket.branding && <img className="ticket-logo" src={ticket.branding.logo} alt={`Logo de ${ticket.restaurant}`} width={112} height={112} />}
            <h4>{ticket.restaurant}</h4>
            <p className="ticket-center">
              {ticket.branch}
              {ticket.address && (
                <>
                  <br />
                  {ticket.address}
                </>
              )}
            </p>
            <h5>{ticket.title}</h5>
            <p
              className={`ticket-notice ${ticket.notice === "Pago registrado" ? "ticket-paid" : ""}`}
            >
              {ticket.notice}
            </p>
            <p>
              Cuenta #{ticket.order.number} · {ticket.order.tableName}
              <br />
              {date(ticket.order.createdAt)}
              <br />
              Atendió: {ticket.order.createdByName}
            </p>
            <ul>
              {ticket.order.items.map((i, index) => (
                <li key={index}>
                  <div className="ticket-line">
                    <strong>
                      {i.quantity} × {i.name}
                    </strong>
                    <span>{money(i.lineTotalCents)}</span>
                  </div>
                  <small>{money(i.unitPriceCents)} c/u</small>
                </li>
              ))}
            </ul>
            <p className="ticket-line ticket-total">
              <strong>Total MXN</strong>
              <strong>{money(ticket.order.totalCents)}</strong>
            </p>
            {ticket.payment && (
              <div className="ticket-payment">
                <p>
                  Pago:{" "}
                  <strong>
                    {ticket.payment.method === "CASH"
                      ? "Efectivo"
                      : ticket.payment.method === "MIXED"
                        ? "Mixto"
                        : "Tarjeta"}
                  </strong>
                  <br />
                  Total pagado: {money(ticket.payment.amountCents)}
                  {ticket.payment.method === "MIXED" && (
                    <>
                      <br />
                      Efectivo: {money(ticket.payment.cashAmountCents)}
                      <br />
                      Tarjeta: {money(ticket.payment.cardAmountCents)}
                    </>
                  )}
                  {ticket.payment.method !== "CARD" && (
                    <>
                      <br />
                      Recibido:{" "}
                      {money(
                        ticket.payment.method === "MIXED"
                          ? ticket.payment.receivedCents -
                              ticket.payment.cardAmountCents
                          : ticket.payment.receivedCents,
                      )}
                      <br />
                      Cambio: {money(ticket.payment.changeCents)}
                    </>
                  )}
                  {ticket.payment.reference && (
                    <>
                      <br />
                      Folio terminal: {ticket.payment.reference}
                    </>
                  )}
                  <br />
                  Registró: {ticket.payment.actorName}
                  <br />
                  {date(ticket.payment.createdAt)}
                </p>
                <small>Referencia de pago: {ticket.payment.id}</small>
              </div>
            )}
            <small>Referencia de cuenta: {ticket.order.id}</small>
            <p className="ticket-center">Tecnología Tavixo · Ticket digital</p>
          </article>
          <div className="actions">
            <button disabled={disabled || busy} onClick={download}>
              Descargar PDF
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setTicket(null)}
            >
              Cerrar ticket
            </button>
          </div>
        </>
      )}
    </section>
  );
}
