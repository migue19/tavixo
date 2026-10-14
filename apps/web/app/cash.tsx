"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "./management";
type Branch = { id: string; name: string; active: boolean };
type Summary = {
  day: string;
  timezone: string;
  branch: { id: string; name: string };
  restaurantName: string;
  periodEnd: string;
  generatedAt: string;
  paymentCount: number;
  mixedCount?: number;
  totalCents: number;
  cash: {
    count: number;
    totalCents: number;
    receivedCents: number;
    changeCents: number;
  };
  card: { count: number; totalCents: number };
  detailLimit: number;
  payments: {
    id: string;
    method: string;
    amountCents: number;
    cashAmountCents?: number;
    cardAmountCents?: number;
    receivedCents: number;
    changeCents: number;
    reference: string;
    actorName: string;
    createdAt: string;
    order: { number: number; tableName: string };
  }[];
};
type Cut = {
  id: string;
  day: string;
  openingCents: number;
  countedCents: number;
  actorName: string;
  notes: string;
  createdAt: string;
  snapshot: Summary & { expectedCents: number; differenceCents: number };
};
type Payload = {
  day: string;
  requestId: string;
  openingCents: number;
  countedCents: number;
  expectedTotalCents: number;
  expectedPaymentCount: number;
  notes: string;
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
const date = (s: string) =>
  new Date(s).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function cents(s: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  return n <= 2147483647 ? n : null;
}
export default function Cash({
  session,
  branches,
  online,
}: {
  session: Session;
  branches: Branch[];
  online: boolean;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [day, setDay] = useState(today);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [selected, setSelected] = useState<Cut | null>(null);
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const locked = useRef(false),
    sequence = useRef(0);
  const key = `tavixo-cut-${session.restaurant.id}-${branchId}`;
  const api = useCallback(
    async (path: string, body?: Payload) => {
      const response = await fetch(
        `/api/restaurant/branches/${branchId}/cash/${path}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Object.assign(
          new Error(
            Array.isArray(data.message)
              ? "Revisa la fecha y los importes"
              : (data.message ?? "No se pudo completar la operación"),
          ),
          { status: response.status },
        );
      return data;
    },
    [branchId, session.accessToken],
  );
  const refresh = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const [report, history] = await Promise.all([
        api(`summary?day=${day}`),
        api(`cuts?day=${day}`),
      ]);
      if (sequence.current === version) {
        setSummary(report);
        setCuts(history);
      }
    } catch (e) {
      if (sequence.current === version) {
        setSummary(null);
        setCuts([]);
        setError(e instanceof Error ? e.message : "Revisa la conexión");
      }
    } finally {
      if (sequence.current === version) setLoading(false);
    }
  }, [api, day]);
  useEffect(() => {
    setSummary(null);
    setCuts([]);
    setSelected(null);
    setNotice("");
    setOpening("0");
    setCounted("");
    setNotes("");
    try {
      setPending(JSON.parse(sessionStorage.getItem(key) ?? "null"));
    } catch {
      setPending(null);
    }
    return () => {
      sequence.current++;
    };
  }, [branchId, day, key]);
  useEffect(() => {
    if (online && branchId) void refresh();
    else setLoading(false);
    return () => {
      sequence.current++;
    };
  }, [refresh, online, branchId]);
  const openingValue = cents(opening),
    countedValue = cents(counted);
  const expected =
    summary && openingValue !== null
      ? openingValue + summary.cash.totalCents
      : null;
  const difference =
    expected !== null && countedValue !== null ? countedValue - expected : null;
  const disabled = busy || loading || !online;
  async function save() {
    if (
      locked.current ||
      disabled ||
      (!pending && (!summary || openingValue === null || countedValue === null))
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = pending ?? {
        day,
        requestId: crypto.randomUUID(),
        openingCents: openingValue!,
        countedCents: countedValue!,
        expectedTotalCents: summary!.totalCents,
        expectedPaymentCount: summary!.paymentCount,
        notes,
      };
      sessionStorage.setItem(key, JSON.stringify(body));
      setPending(body);
      const cut: Cut = await api("cuts", body);
      sessionStorage.removeItem(key);
      setPending(null);
      setSelected(cut);
      setNotice(
        "Corte guardado. Los cobros posteriores no cambiarán este corte.",
      );
      await refresh();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![401, 408, 429].includes(status)
      ) {
        sessionStorage.removeItem(key);
        setPending(null);
      }
      setError(
        e instanceof Error
          ? e.message
          : "No recibimos respuesta; reintenta el mismo corte",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const report = selected?.snapshot ?? summary;
  return (
    <section>
      <h2>Caja y ventas</h2>
      <p>
        Resumen acumulado de cobros del día por sucursal · horario de México.
        Los cortes guardados son una fotografía del momento; no cierran la
        operación ni bloquean nuevos cobros.
      </p>
      <div className="field-row">
        <label>
          Sucursal
          <select
            value={branchId}
            disabled={disabled || !!pending}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.active ? "" : " · Inactiva"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Día de cobro
          <input
            type="date"
            value={day}
            max={today()}
            disabled={busy || !!pending}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => {
            setSelected(null);
            void refresh();
          }}
        >
          Actualizar resumen
        </button>
      </div>
      {!online && (
        <p className="alert">Conéctate para consultar y guardar cortes.</p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {loading && <p>Cargando resumen…</p>}
      {report && (
        <>
          {selected && (
            <p className="success">
              Corte guardado por {selected.actorName} ·{" "}
              {date(selected.createdAt)}{" "}
              <button className="secondary" onClick={() => setSelected(null)}>
                Volver al resumen actual
              </button>
            </p>
          )}
          <p>
            {report.branch.name} · {report.day} · Cobros incluidos hasta{" "}
            {date(report.periodEnd)}
          </p>
          <div className="stats">
            <article className="card">
              <span>Ventas cobradas</span>
              <strong>{money(report.totalCents)}</strong>
            </article>
            <article className="card">
              <span>Efectivo · {report.cash.count} cuentas con efectivo</span>
              <strong>{money(report.cash.totalCents)}</strong>
            </article>
            <article className="card">
              <span>Tarjeta · {report.card.count} cuentas con tarjeta</span>
              <strong>{money(report.card.totalCents)}</strong>
            </article>
          </div>
          <p>
            {report.paymentCount} cuentas cobradas ({report.mixedCount ?? 0}{" "}
            mixtas). El efectivo corresponde a venta neta, después de devolver
            el cambio. Cuentas abiertas, canceladas o históricas sin pago quedan
            fuera.
          </p>
          {selected ? (
            <article className="card">
              <h3>Conciliación guardada</h3>
              <dl className="cash-reconciliation">
                <dt>Fondo inicial</dt>
                <dd>{money(selected.openingCents)}</dd>
                <dt>Efectivo esperado</dt>
                <dd>{money(selected.snapshot.expectedCents)}</dd>
                <dt>Efectivo contado</dt>
                <dd>{money(selected.countedCents)}</dd>
                <dt>
                  {selected.snapshot.differenceCents < 0
                    ? "Faltante"
                    : selected.snapshot.differenceCents > 0
                      ? "Sobrante"
                      : "Diferencia"}
                </dt>
                <dd>{money(Math.abs(selected.snapshot.differenceCents))}</dd>
              </dl>
              {selected.notes && <p>{selected.notes}</p>}
            </article>
          ) : (
            <article className="card">
              <h3>Guardar corte de caja</h3>
              <p>
                Incluye el fondo inicial en el efectivo contado. Sin retiros,
                gastos, depósitos ni propinas en esta entrega.
              </p>
              {pending ? (
                <>
                  <p className="alert">
                    Hay un corte pendiente de confirmar del {pending.day}.
                    Reintenta el mismo envío para evitar duplicados.
                  </p>
                  <p>
                    Fondo {money(pending.openingCents)} · Contado{" "}
                    {money(pending.countedCents)}
                  </p>
                  <button disabled={disabled} onClick={() => void save()}>
                    Reintentar corte
                  </button>
                </>
              ) : (
                <>
                  <div className="field-row">
                    <label>
                      Fondo inicial (MXN)
                      <input
                        inputMode="decimal"
                        value={opening}
                        disabled={disabled}
                        onChange={(e) => setOpening(e.target.value)}
                      />
                    </label>
                    <label>
                      Efectivo contado (MXN)
                      <input
                        inputMode="decimal"
                        value={counted}
                        disabled={disabled}
                        onChange={(e) => setCounted(e.target.value)}
                      />
                    </label>
                  </div>
                  <p>
                    Efectivo esperado:{" "}
                    <strong>{expected === null ? "—" : money(expected)}</strong>
                  </p>
                  <p>
                    {difference !== null && difference < 0
                      ? "Faltante"
                      : difference !== null && difference > 0
                        ? "Sobrante"
                        : "Diferencia"}
                    :{" "}
                    <strong>
                      {difference === null ? "—" : money(Math.abs(difference))}
                    </strong>
                  </p>
                  <label>
                    Notas del corte
                    <textarea
                      maxLength={500}
                      value={notes}
                      disabled={disabled}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={
                      disabled || openingValue === null || countedValue === null
                    }
                    onClick={() => void save()}
                  >
                    Guardar corte
                  </button>
                </>
              )}
            </article>
          )}
          <article className="card">
            <h3>Detalle de cobros</h3>
            {report.paymentCount > report.detailLimit && (
              <p>
                Mostrando los últimos {report.detailLimit} cobros. Los totales
                incluyen todos los cobros del período.
              </p>
            )}
            {!report.payments.length ? (
              <p>No hay cobros registrados en este día.</p>
            ) : (
              <div className="cash-table">
                <table>
                  <thead>
                    <tr>
                      <th>Cuenta / mesa</th>
                      <th>Hora</th>
                      <th>Método</th>
                      <th>Importe</th>
                      <th>Registró / folio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          #{p.order.number} · {p.order.tableName}
                        </td>
                        <td>{date(p.createdAt)}</td>
                        <td>
                          {p.method === "CASH"
                            ? "Efectivo"
                            : p.method === "MIXED"
                              ? "Mixto"
                              : "Tarjeta"}
                        </td>
                        <td>
                          {money(p.amountCents)}
                          {p.method === "MIXED" && (
                            <>
                              <br />
                              <small>
                                Efectivo {money(p.cashAmountCents ?? 0)} ·
                                Tarjeta {money(p.cardAmountCents ?? 0)}
                              </small>
                            </>
                          )}
                        </td>
                        <td>
                          {p.actorName}
                          {p.reference && ` · ${p.reference}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
      <article className="card">
        <h3>Cortes guardados del día</h3>
        <p>
          Cada corte es acumulado desde medianoche; no sumes varios cortes del
          mismo día. Se muestran los últimos 50.
        </p>
        {cuts.length ? (
          cuts.map((c) => (
            <div className="record" key={c.id}>
              <p>
                {date(c.createdAt)} · {c.actorName} · Ventas{" "}
                {money(c.snapshot.totalCents)} ·{" "}
                {c.snapshot.differenceCents < 0
                  ? "Faltante"
                  : c.snapshot.differenceCents > 0
                    ? "Sobrante"
                    : "Diferencia"}{" "}
                {money(Math.abs(c.snapshot.differenceCents))}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setSelected(c)}
              >
                Ver corte del {date(c.createdAt)}
              </button>
            </div>
          ))
        ) : (
          <p>No hay cortes guardados.</p>
        )}
      </article>
    </section>
  );
}
