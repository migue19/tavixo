"use client";
import { useEffect, useRef, useState } from "react";
import type { Order } from "./orders";
export type Payment = {
  id: string;
  requestId: string;
  method: "CASH" | "CARD" | "MIXED";
  amountCents: number;
  cashAmountCents: number | null;
  cardAmountCents: number | null;
  receivedCents: number;
  changeCents: number;
  reference: string;
  actorName: string;
  createdAt: string;
};
type Payload = {
  cardAmountCents?: number;
  requestId: string;
  method: "CASH" | "CARD" | "MIXED";
  receivedCents: number;
  expectedTotalCents: number;
  reference: string;
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
function cents(value: string): number | null {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return n <= 2147483647 ? n : null;
}
export default function PaymentPanel({
  order,
  storageKey,
  canPay,
  disabled,
  api,
  onPaid,
}: {
  order: Order;
  storageKey: string;
  canPay: boolean;
  disabled: boolean;
  api: (path: string, method?: string, body?: unknown) => Promise<Order>;
  onPaid: (order: Order) => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"CASH" | "CARD" | "MIXED">("CASH");
  const [received, setReceived] = useState("");
  const [cardPart, setCardPart] = useState("");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  useEffect(() => {
    try {
      setPending(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"));
    } catch {
      setPending(null);
    }
  }, [storageKey]);
  useEffect(() => {
    if (order.payment && pending?.requestId === order.payment.requestId) {
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setError("");
    }
  }, [order.payment, pending, storageKey]);
  const cardValue =
    method === "MIXED"
      ? cents(cardPart)
      : method === "CARD"
        ? order.totalCents
        : 0;
  const cashPart = cardValue !== null ? order.totalCents - cardValue : null;
  const cashReceived = cents(received);
  useEffect(() => setConfirmed(false), [order.totalCents]);
  const value =
    method === "CARD"
      ? order.totalCents
      : method === "MIXED"
        ? cashReceived !== null && cardValue !== null
          ? cashReceived + cardValue
          : null
        : cashReceived;
  const valid =
    value !== null &&
    value <= 2147483647 &&
    value >= order.totalCents &&
    (method !== "MIXED" ||
      (cardValue !== null && cardValue > 0 && cardValue < order.totalCents)) &&
    (method === "CASH" || (reference.trim().length > 0 && confirmed));
  async function pay() {
    if (disabled || locked.current || !canPay || (!pending && !valid)) return;
    const payload = pending ?? {
      requestId: crypto.randomUUID(),
      method,
      ...(method === "MIXED" ? { cardAmountCents: cardValue! } : {}),
      receivedCents: value!,
      expectedTotalCents: order.totalCents,
      reference: method !== "CASH" ? reference.trim() : "",
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      setError(
        "No se pudo guardar la referencia del cobro. Habilita el almacenamiento del navegador.",
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    setPending(payload);
    setError("");
    try {
      const next = await api(`orders/${order.id}/payment`, "POST", payload);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setOpen(false);
      onPaid(next);
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![401, 408, 429].includes(status)
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(
        e instanceof Error
          ? e.message
          : "No se confirmó el registro. Reintenta el mismo cobro.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (order.payment) {
    const p = order.payment;
    return (
      <section className="payment-receipt" aria-label="Pago registrado">
        <h4>
          Pago registrado ·{" "}
          {p.method === "CASH"
            ? "Efectivo"
            : p.method === "MIXED"
              ? "Mixto"
              : "Tarjeta"}
        </h4>
        <dl>
          <div>
            <dt>Total pagado</dt>
            <dd>{money(p.amountCents)}</dd>
          </div>
          {p.method === "MIXED" && (
            <>
              <div>
                <dt>Parte en efectivo</dt>
                <dd>{money(p.cashAmountCents ?? 0)}</dd>
              </div>
              <div>
                <dt>Parte en tarjeta</dt>
                <dd>{money(p.cardAmountCents ?? 0)}</dd>
              </div>
            </>
          )}
          {p.method !== "CARD" && (
            <>
              <div>
                <dt>
                  {p.method === "MIXED" ? "Efectivo recibido" : "Recibido"}
                </dt>
                <dd>
                  {money(
                    p.method === "MIXED"
                      ? p.receivedCents - (p.cardAmountCents ?? 0)
                      : p.receivedCents,
                  )}
                </dd>
              </div>
              <div>
                <dt>Cambio</dt>
                <dd>{money(p.changeCents)}</dd>
              </div>
            </>
          )}
          {p.reference && (
            <div>
              <dt>Folio de terminal</dt>
              <dd>{p.reference}</dd>
            </div>
          )}
          <div>
            <dt>Registró</dt>
            <dd>{p.actorName}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{new Date(p.createdAt).toLocaleString("es-MX")}</dd>
          </div>
        </dl>
      </section>
    );
  }
  if (order.status === "CLOSED")
    return (
      <p className="badge muted">
        Cerrada sin pago registrado · historial anterior
      </p>
    );
  if (!canPay || order.status !== "DELIVERED") return null;
  return (
    <section className="payment-panel">
      <button
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
        className="secondary"
      >
        {open ? "Ocultar cobro" : "Cobrar cuenta"}
      </button>
      {(open || pending) && (
        <form
          aria-label="Registrar cobro"
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
        >
          <h4>
            Cobrar #{order.number} · {money(order.totalCents)}
          </h4>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          {pending ? (
            <>
              <p className="alert">
                Hay un cobro pendiente de confirmar. Reintenta el mismo
                registro; no vuelvas a cobrar al cliente.
              </p>
              <p>
                {pending.method === "CASH"
                  ? "Efectivo"
                  : pending.method === "MIXED"
                    ? "Mixto"
                    : "Tarjeta"}{" "}
                · Total recibido {money(pending.receivedCents)}
              </p>
              <button disabled={disabled || busy}>Reintentar registro</button>
            </>
          ) : (
            <>
              <label>
                Forma de pago
                <select
                  value={method}
                  disabled={disabled || busy}
                  onChange={(e) => {
                    setMethod(e.target.value as "CASH" | "CARD" | "MIXED");
                    setConfirmed(false);
                  }}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta · terminal externa</option>
                  <option value="MIXED">Mixto · efectivo y tarjeta</option>
                </select>
              </label>
              {method === "MIXED" && (
                <>
                  <label>
                    Importe con tarjeta (MXN)
                    <input
                      inputMode="decimal"
                      value={cardPart}
                      disabled={disabled || busy}
                      onChange={(e) => {
                        setCardPart(e.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  <p>
                    Parte en efectivo:{" "}
                    <strong>
                      {cashPart !== null && cashPart > 0
                        ? money(cashPart)
                        : "—"}
                    </strong>
                  </p>
                </>
              )}
              {method !== "CARD" && (
                <>
                  <label>
                    Efectivo recibido (MXN)
                    <input
                      required
                      inputMode="decimal"
                      value={received}
                      placeholder="Ejemplo: 200.00"
                      disabled={disabled || busy}
                      onChange={(e) => setReceived(e.target.value)}
                    />
                  </label>
                  <p className="order-total">
                    Cambio{" "}
                    <strong>
                      {value !== null && value >= order.totalCents
                        ? money(value - order.totalCents)
                        : "—"}
                    </strong>
                  </p>
                  {value !== null && value < order.totalCents && (
                    <p>
                      El efectivo recibido debe cubrir{" "}
                      {method === "MIXED" ? "la parte en efectivo" : "el total"}
                      .
                    </p>
                  )}
                </>
              )}
              {method !== "CASH" && (
                <>
                  <p>
                    Realiza el cobro de {money(cardValue ?? 0)} en tu terminal
                    antes de registrarlo aquí. Tavixo no procesa tarjetas.
                  </p>
                  <label>
                    Folio de terminal
                    <input
                      required
                      maxLength={80}
                      value={reference}
                      disabled={disabled || busy}
                      placeholder="Sólo folio, sin datos de la tarjeta"
                      onChange={(e) => {
                        setReference(e.target.value);
                        setConfirmed(false);
                      }}
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      required
                      checked={confirmed}
                      disabled={disabled || busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    Confirmo que la terminal aprobó el pago
                  </label>
                </>
              )}
              <p>
                Al registrar el pago, la cuenta se cerrará y la mesa quedará
                libre.
              </p>
              <button disabled={disabled || busy || !valid}>
                Registrar pago y cerrar cuenta
              </button>
            </>
          )}
        </form>
      )}
    </section>
  );
}
