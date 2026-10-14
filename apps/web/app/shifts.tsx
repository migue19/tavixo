"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "./management";
type Branch = { id: string; name: string; active: boolean };
type Summary = {
  cashCents: number;
  cardCents: number;
  totalCents: number;
  paymentCount: number;
  mixedCount: number;
  withdrawalsCents: number;
  expensesCents: number;
  expectedCents: number;
  movementCount: number;
  detailLimit: number;
  movements: {
    id: string;
    kind: string;
    amountCents: number;
    reason: string;
    actorName: string;
    createdAt: string;
  }[];
  differenceCents?: number;
};
type Shift = {
  id: string;
  branchId: string;
  openingCents: number;
  openedByName: string;
  openedAt: string;
  revision: number;
  closedAt: string | null;
  closedByName: string;
  countedCents: number | null;
  notes: string;
  snapshot: Summary | null;
  summary?: Summary;
};
type Pending = {
  path: string;
  body: Record<string, string | number>;
  label: string;
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
const date = (s: string) =>
  new Date(s).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
function cents(s: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ""] = s.split(".");
  const value = Number(a) * 100 + Number(b.padEnd(2, "0"));
  return value <= 2147483647 ? value : null;
}
export default function Shifts({
  session,
  branches,
  online,
}: {
  session: Session;
  branches: Branch[];
  online: boolean;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? ""),
    [active, setActive] = useState<Shift | null>(null),
    [history, setHistory] = useState<Shift[]>([]),
    [selected, setSelected] = useState<Shift | null>(null);
  const [opening, setOpening] = useState("0"),
    [amount, setAmount] = useState(""),
    [kind, setKind] = useState("WITHDRAWAL"),
    [reason, setReason] = useState(""),
    [counted, setCounted] = useState(""),
    [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState<Pending | null>(null);
  const sequence = useRef(0),
    locked = useRef(false);
  const key = `tavixo-shift-${session.restaurant.id}-${branchId}`;
  useEffect(() => {
    setBranchId((current) =>
      branches.some((b) => b.id === current)
        ? current
        : (branches.find((b) => b.active)?.id ?? branches[0]?.id ?? ""),
    );
  }, [branches]);
  const api = useCallback(
    async (path: string, body?: Pending["body"]) => {
      const res = await fetch(
        `/api/restaurant/branches/${branchId}/cash/shifts${path}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw Object.assign(
          new Error(
            Array.isArray(data.message)
              ? "Revisa los importes y el motivo"
              : (data.message ?? "No se pudo completar la operación"),
          ),
          { status: res.status },
        );
      return data;
    },
    [branchId, session.accessToken],
  );
  const refresh = useCallback(async () => {
    const n = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const data = await api("");
      if (sequence.current === n) {
        setActive(data.active);
        setHistory(data.history);
      }
    } catch (e) {
      if (sequence.current === n)
        setError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally {
      if (sequence.current === n) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    setActive(null);
    setHistory([]);
    setSelected(null);
    setNotice("");
    setAmount("");
    setReason("");
    setCounted("");
    setNotes("");
    setOpening("0");
    try {
      setPending(JSON.parse(sessionStorage.getItem(key) ?? "null"));
    } catch {
      setPending(null);
    }
    return () => {
      sequence.current++;
    };
  }, [key]);
  useEffect(() => {
    if (online && branchId) void refresh();
    else setLoading(false);
    return () => {
      sequence.current++;
    };
  }, [refresh, online, branchId]);
  const disabled = busy || loading || !online;
  async function act(operation: Pending) {
    if (locked.current || disabled) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const op = pending ?? operation;
      sessionStorage.setItem(key, JSON.stringify(op));
      setPending(op);
      const result = await api(op.path, op.body);
      sessionStorage.removeItem(key);
      setPending(null);
      setAmount("");
      setReason("");
      setCounted("");
      setNotes("");
      setSelected(op.path.endsWith("/close") ? result : null);
      setNotice(`${op.label} registrado correctamente`);
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
          : "Sin respuesta; reintenta el mismo envío",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const reportShift = selected ?? active;
  const report = selected?.snapshot ?? active?.summary;
  const openingValue = cents(opening),
    amountValue = cents(amount),
    countedValue = cents(counted);
  return (
    <section className="cash-shifts">
      <h2>Turnos de caja</h2>
      <p>
        Una caja compartida por sucursal. Los cobros registrados durante un
        turno abierto se asocian a él, aunque cruce medianoche. Sin turno
        abierto, los cobros siguen disponibles en el resumen diario y no se
        agregan después a un turno.
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
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => {
            setSelected(null);
            void refresh();
          }}
        >
          Actualizar caja
        </button>
      </div>
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
      {!online && <p className="alert">Conéctate para operar la caja.</p>}
      {loading && <p>Cargando caja…</p>}
      {pending && (
        <article className="card">
          <p className="alert">
            Hay un envío pendiente: {pending.label}. Reintenta el mismo envío
            para evitar duplicados.
          </p>
          <button disabled={disabled} onClick={() => void act(pending)}>
            Reintentar envío de caja
          </button>
        </article>
      )}
      {report && reportShift && (
        <>
          <p>
            {selected ? "Turno cerrado" : "Turno abierto"} · Apertura{" "}
            {date(reportShift.openedAt)} · {reportShift.openedByName}
            {reportShift.closedAt &&
              ` · Cierre ${date(reportShift.closedAt)} · ${reportShift.closedByName}`}
          </p>
          {selected && (
            <button className="secondary" onClick={() => setSelected(null)}>
              Volver a caja actual
            </button>
          )}
          <div className="stats">
            <article>
              <span>Ventas del turno · {report.paymentCount} cuentas</span>
              <strong>{money(report.totalCents)}</strong>
            </article>
            <article>
              <span>Ventas en efectivo</span>
              <strong>{money(report.cashCents)}</strong>
            </article>
            <article>
              <span>Ventas con tarjeta</span>
              <strong>{money(report.cardCents)}</strong>
            </article>
          </div>
          <article className="card">
            <h3>
              {selected ? "Cierre guardado" : "Efectivo esperado del turno"}
            </h3>
            <dl className="cash-reconciliation">
              <dt>Fondo inicial</dt>
              <dd>{money(reportShift.openingCents)}</dd>
              <dt>Ventas netas en efectivo</dt>
              <dd>{money(report.cashCents)}</dd>
              <dt>Retiros</dt>
              <dd>{money(report.withdrawalsCents)}</dd>
              <dt>Gastos</dt>
              <dd>{money(report.expensesCents)}</dd>
              <dt>Efectivo esperado</dt>
              <dd>{money(report.expectedCents)}</dd>
              {selected && (
                <>
                  <dt>Efectivo contado</dt>
                  <dd>{money(reportShift.countedCents ?? 0)}</dd>
                  <dt>
                    {(report.differenceCents ?? 0) < 0
                      ? "Faltante"
                      : (report.differenceCents ?? 0) > 0
                        ? "Sobrante"
                        : "Diferencia"}
                  </dt>
                  <dd>{money(Math.abs(report.differenceCents ?? 0))}</dd>
                </>
              )}
            </dl>
            {reportShift.notes && <p>{reportShift.notes}</p>}
          </article>
          <article className="card">
            <h3>Movimientos del turno</h3>
            {report.movementCount > report.detailLimit && (
              <p>
                Últimos {report.detailLimit} movimientos. Los totales incluyen
                todos.
              </p>
            )}
            {report.movements.length ? (
              report.movements.map((m) => (
                <div className="record" key={m.id}>
                  <strong>
                    {m.kind === "WITHDRAWAL" ? "Retiro" : "Gasto"} ·{" "}
                    {money(m.amountCents)}
                  </strong>
                  <p>
                    {m.reason} · {m.actorName} · {date(m.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p>Sin retiros ni gastos.</p>
            )}
          </article>
        </>
      )}
      {!pending &&
        !selected &&
        !loading &&
        (active ? (
          <div className="management-grid">
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                void act({
                  path: `/${active.id}/movements`,
                  label: kind === "WITHDRAWAL" ? "Retiro" : "Gasto",
                  body: {
                    requestId: crypto.randomUUID(),
                    kind,
                    amountCents: amountValue!,
                    reason: reason.trim(),
                    expectedRevision: active.revision,
                  },
                });
              }}
            >
              <h3>Registrar retiro o gasto</h3>
              <label>
                Movimiento
                <select
                  value={kind}
                  disabled={disabled}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="WITHDRAWAL">Retiro</option>
                  <option value="EXPENSE">Gasto</option>
                </select>
              </label>
              <label>
                Importe del movimiento (MXN)
                <input
                  inputMode="decimal"
                  value={amount}
                  disabled={disabled}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Motivo del movimiento
                <input
                  value={reason}
                  maxLength={500}
                  required
                  disabled={disabled}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                disabled={
                  disabled ||
                  amountValue === null ||
                  amountValue <= 0 ||
                  amountValue > (active.summary?.expectedCents ?? 0) ||
                  !reason.trim()
                }
              >
                Guardar movimiento
              </button>
            </form>
            <form
              className="card"
              onSubmit={(e) => {
                e.preventDefault();
                void act({
                  path: `/${active.id}/close`,
                  label: "Cierre de turno",
                  body: {
                    requestId: crypto.randomUUID(),
                    countedCents: countedValue!,
                    notes: notes.trim(),
                    expectedRevision: active.revision,
                  },
                });
              }}
            >
              <h3>Cerrar turno</h3>
              <p>
                Cuenta todo el efectivo, incluido el fondo inicial. El cierre
                conserva las ventas y movimientos del turno.
              </p>
              <label>
                Efectivo contado al cierre (MXN)
                <input
                  inputMode="decimal"
                  value={counted}
                  disabled={disabled}
                  onChange={(e) => setCounted(e.target.value)}
                />
              </label>
              <p>
                Diferencia:{" "}
                <strong>
                  {countedValue !== null
                    ? money(countedValue - (active.summary?.expectedCents ?? 0))
                    : "—"}
                </strong>
              </p>
              <label>
                Notas del cierre
                <textarea
                  value={notes}
                  maxLength={500}
                  disabled={disabled}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button disabled={disabled || countedValue === null}>
                Guardar cierre de turno
              </button>
            </form>
          </div>
        ) : (
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              void act({
                path: "",
                label: "Apertura de turno",
                body: {
                  requestId: crypto.randomUUID(),
                  openingCents: openingValue!,
                },
              });
            }}
          >
            <h3>Abrir turno de caja</h3>
            <label>
              Fondo inicial del turno (MXN)
              <input
                inputMode="decimal"
                value={opening}
                disabled={disabled}
                onChange={(e) => setOpening(e.target.value)}
              />
            </label>
            <button
              disabled={
                disabled ||
                openingValue === null ||
                !branches.find((b) => b.id === branchId)?.active
              }
            >
              Abrir turno
            </button>
          </form>
        ))}
      <article className="card">
        <h3>Turnos cerrados</h3>
        <p>Últimos 50 turnos de esta sucursal.</p>
        {history.length ? (
          history.map((s) => (
            <div className="record" key={s.id}>
              <p>
                {date(s.openedAt)} → {date(s.closedAt!)} · {s.closedByName}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setSelected(s)}
              >
                Ver turno del {date(s.openedAt)}
              </button>
            </div>
          ))
        ) : (
          <p>No hay turnos cerrados.</p>
        )}
      </article>
    </section>
  );
}
