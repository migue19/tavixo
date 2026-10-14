"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CancelPayload } from "./item-cancellation";
import Rounds, { type Round } from "./rounds";
import TicketPanel from "./ticket";
import PaymentPanel, { type Payment } from "./payment";
import type { Session } from "./management";
type Branch = { id: string; name: string; active: boolean };
type Product = {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  category: { name: string; active: boolean };
};
type Table = { id: string; name: string; active: boolean };
type Line = { productId: string; quantity: number; notes: string };
type Payload = {
  requestId: string;
  tableId?: string;
  orderId?: string;
  expectedTotalCents?: number;
  notes: string;
  items: Line[];
};
export type Order = {
  rounds: Round[];
  payment: Payment | null;
  id: string;
  number: number;
  tableId: string;
  tableName: string;
  status: string;
  totalCents: number;
  notes: string;
  createdByName: string;
  createdAt: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    cancelledQuantity: number;
    notes: string;
  }[];
  events: {
    id: string;
    status: string;
    actorName: string;
    reason: string;
    createdAt: string;
  }[];
};
const labels: Record<string, string> = {
  SENT: "Enviada",
  PREPARING: "En preparación",
  READY: "Lista",
  DELIVERED: "Entregada",
  CLOSED: "Cuenta cerrada",
  CANCELLED: "Cancelada",
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
const finished = (o: Order) => ["CLOSED", "CANCELLED"].includes(o.status);
export default function Orders({
  session,
  branches,
  online,
  kitchen,
}: {
  session: Session;
  branches: Branch[];
  online: boolean;
  kitchen: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [cart, setCart] = useState<Line[]>([]);
  const [tableId, setTableId] = useState("");
  const [targetOrderId, setTargetOrderId] = useState("");
  const composeRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(false);
  const [pending, setPending] = useState<Payload | null>(null);
  const [confirmation, setConfirmation] = useState<{
    order: Order;
    status: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const sequence = useRef(0);
  const role = session.user.role;
  const admin = ["OWNER", "MANAGER"].includes(role);
  const floor = admin || ["WAITER", "CASHIER"].includes(role);
  const canPay = admin || role === "CASHIER";
  const cook = admin || role === "KITCHEN";
  const storageKey = `tavixo-order-${session.restaurant.id}-${branchId}`;
  useEffect(() => {
    setBranchId((current) =>
      branches.some((b) => b.id === current && b.active)
        ? current
        : (branches.find((b) => b.active)?.id ?? ""),
    );
  }, [branches]);
  const api = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const res = await fetch(`/api/restaurant/branches/${branchId}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const value = await res.json();
      if (!res.ok) {
        const e = new Error(
          Array.isArray(value.message)
            ? "Revisa los campos de la comanda"
            : (value.message ?? "No se pudo completar la operación"),
        ) as Error & { status: number };
        e.status = res.status;
        throw e;
      }
      return value;
    },
    [branchId, session.accessToken],
  );
  const load = useCallback(
    () =>
      Promise.all([api("orders"), api("products"), api("tables")]) as Promise<
        [Order[], Product[], Table[]]
      >,
    [api],
  );
  useEffect(() => {
    setConfirmation(null);
    setOrders([]);
    setProducts([]);
    setTables([]);
    setCart([]);
    setNotes("");
    setTableId("");
    setTargetOrderId("");
    setError("");
    setNotice("");
    try {
      setPending(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"));
    } catch {
      setPending(null);
    }
  }, [branchId, storageKey]);
  useEffect(() => {
    const current = ++sequence.current;
    setLoading(true);
    if (!branchId || !online) {
      setLoading(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const [o, p, t] = await load();
        if (sequence.current !== current) return;
        setOrders(o);
        setProducts(p);
        setTables(t);
        setError("");
      } catch (e) {
        if (sequence.current === current)
          setError(e instanceof Error ? e.message : "Revisa tu conexión");
      } finally {
        if (sequence.current === current) {
          setLoading(false);
          timer = setTimeout(refresh, 5000);
        }
      }
    }
    void refresh();
    return () => {
      sequence.current++;
      clearTimeout(timer);
    };
  }, [branchId, online, load]);
  const occupied = new Set(
    orders.filter((o) => !finished(o)).map((o) => o.tableId),
  );
  const disabled = busy || loading || !online;
  const targetOrder = orders.find(
    (o) => o.id === targetOrderId && !finished(o),
  );
  async function submit() {
    if (disabled) return;
    if (!pending && targetOrderId && !targetOrder) {
      setError("La cuenta ya no está abierta; actualiza antes de enviar");
      return;
    }
    const payload: Payload = pending ?? {
      requestId: crypto.randomUUID(),
      notes,
      items: cart,
      ...(targetOrder
        ? {
            orderId: targetOrder.id,
            expectedTotalCents: targetOrder.totalCents,
          }
        : { tableId }),
    };
    // Keep the exact request across a lost response, navigation or reload.
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      setError(
        "No se pudo guardar la referencia del envío. Habilita el almacenamiento del navegador.",
      );
      return;
    }
    setPending(payload);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { orderId, ...body } = payload;
      const order: Order = await api(
        orderId ? `orders/${orderId}/rounds` : "orders",
        "POST",
        body,
      );
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setCart([]);
      setTableId("");
      setNotes("");
      setTargetOrderId("");
      setNotice(
        `Comanda #${order.number}: ${payload.orderId ? "nueva ronda enviada" : "enviada"} a cocina`,
      );
      const [o, p, t] = await load();
      setOrders(o);
      setProducts(p);
      setTables(t);
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
          : "No recibimos respuesta. Reintenta el mismo envío.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function change(order: Order, status: string, reason = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`orders/${order.id}/status`, "PATCH", {
        status,
        expectedStatus: order.status,
        reason,
      });
      const [o, p, t] = await load();
      setOrders(o);
      setProducts(p);
      setTables(t);
      setConfirmation(null);
      setReason("");
      setNotice(`Comanda #${order.number}: ${labels[status]}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally {
      setBusy(false);
    }
  }
  async function changeRound(order: Order, round: Round, status: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next: Order = await api(
        `orders/${order.id}/rounds/${round.id}/status`,
        "PATCH",
        { status, expectedStatus: round.status },
      );
      setOrders((current) => current.map((o) => (o.id === next.id ? next : o)));
      setNotice(
        `Comanda #${order.number} · Ronda ${round.number}: ${labels[status]}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally {
      setBusy(false);
    }
  }
  function update(id: string, patch: Partial<Line>) {
    setCart((lines) =>
      lines.map((l) => (l.productId === id ? { ...l, ...patch } : l)),
    );
  }
  const visible = orders.filter((o) =>
    kitchen
      ? ["SENT", "PREPARING", "READY"].includes(o.status)
      : history || !finished(o),
  );
  return (
    <section className="orders">
      <div className="catalog-heading">
        <div>
          <h2>{kitchen ? "Cocina" : "Comandas"}</h2>
          <p>
            {kitchen
              ? "Pedidos pendientes, en preparación y listos para entregar."
              : "Abre una cuenta por mesa y envía el pedido a cocina."}{" "}
            Actualización cada 5 segundos.
          </p>
        </div>
        <label>
          Sucursal
          <select
            value={branchId}
            disabled={busy || !!pending}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches
              .filter((b) => b.active)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {!branchId && <p>Necesitas una sucursal activa asignada.</p>}
      {!online && (
        <p className="alert">
          Sin conexión. Los pedidos sólo se envían cuando hay internet.
        </p>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {loading && branchId && <p role="status">Cargando comandas…</p>}
      {!kitchen && floor && branchId && (
        <div className="management-grid order-compose" ref={composeRef}>
          <article className="card">
            <h3>Seleccionar productos</h3>
            <label>
              Buscar producto
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Taco, quesabirria…"
              />
            </label>
            <div className="order-menu">
              {products
                .filter(
                  (p) =>
                    p.active &&
                    p.category.active &&
                    p.name
                      .toLocaleLowerCase("es")
                      .includes(search.toLocaleLowerCase("es")),
                )
                .map((p) => (
                  <button
                    className="order-product secondary"
                    key={p.id}
                    disabled={disabled || !!pending || !p.available}
                    onClick={() =>
                      setCart((lines) => {
                        const line = lines.find((l) => l.productId === p.id);
                        return line
                          ? lines.map((l) =>
                              l.productId === p.id
                                ? {
                                    ...l,
                                    quantity: Math.min(100, l.quantity + 1),
                                  }
                                : l,
                            )
                          : [
                              ...lines,
                              { productId: p.id, quantity: 1, notes: "" },
                            ];
                      })
                    }
                  >
                    <span>
                      {p.name}
                      <small>
                        {p.category.name}
                        {!p.available ? " · Agotado" : ""}
                      </small>
                    </span>
                    <strong>{money(p.priceCents)}</strong>
                  </button>
                ))}
            </div>
            {!loading && !products.length && (
              <p>Agrega productos al menú para comenzar.</p>
            )}
          </article>
          <article className="card">
            <h3>{targetOrderId ? "Agregar una ronda" : "Nueva comanda"}</h3>
            {pending ? (
              <>
                <p className="alert">
                  Hay un envío pendiente de confirmar. Reintenta la misma
                  comanda para evitar duplicados.
                </p>
                <p>
                  {pending.items.reduce((n, i) => n + i.quantity, 0)} productos
                  ·{" "}
                  {orders.find((o) => o.id === pending.orderId)?.tableName ??
                    tables.find((t) => t.id === pending.tableId)?.name ??
                    "Mesa seleccionada"}
                </p>
                <button disabled={disabled} onClick={submit}>
                  Reintentar envío
                </button>
              </>
            ) : (
              <>
                <label>
                  Destino del pedido
                  <select
                    value={targetOrderId}
                    disabled={disabled}
                    onChange={(e) => setTargetOrderId(e.target.value)}
                  >
                    <option value="">Nueva cuenta</option>
                    {orders
                      .filter((o) => !finished(o))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          #{o.number} · {o.tableName} · {money(o.totalCents)}
                        </option>
                      ))}
                  </select>
                </label>
                {targetOrderId ? (
                  <p>
                    {targetOrder?.tableName} · Cuenta actual:{" "}
                    {money(targetOrder?.totalCents ?? 0)}
                  </p>
                ) : (
                  <>
                    <label>
                      Mesa
                      <select
                        value={tableId}
                        disabled={disabled}
                        onChange={(e) => setTableId(e.target.value)}
                      >
                        <option value="">Seleccionar mesa libre</option>
                        {tables
                          .filter((t) => t.active)
                          .map((t) => (
                            <option
                              key={t.id}
                              value={t.id}
                              disabled={occupied.has(t.id)}
                            >
                              {t.name}
                              {occupied.has(t.id) ? " · Ocupada" : " · Libre"}
                            </option>
                          ))}
                      </select>
                    </label>
                    {!loading && !tables.some((t) => t.active) && (
                      <p>Crea tus mesas en la pestaña Mesas.</p>
                    )}
                  </>
                )}
                <ul>
                  {cart.map((l) => {
                    const p = products.find((p) => p.id === l.productId);
                    return (
                      <li key={l.productId}>
                        <strong>{p?.name}</strong>
                        <div className="field-row">
                          <label>
                            Cantidad
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={l.quantity}
                              disabled={disabled}
                              onChange={(e) =>
                                update(l.productId, {
                                  quantity: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label>
                            Indicaciones
                            <input
                              maxLength={300}
                              value={l.notes}
                              disabled={disabled}
                              placeholder="Sin cebolla…"
                              onChange={(e) =>
                                update(l.productId, { notes: e.target.value })
                              }
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          disabled={disabled}
                          onClick={() =>
                            setCart((lines) =>
                              lines.filter((i) => i.productId !== l.productId),
                            )
                          }
                        >
                          Quitar
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <label>
                  Notas de la comanda
                  <textarea
                    maxLength={500}
                    value={notes}
                    disabled={disabled}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <p className="order-total">
                  {targetOrderId ? "Nueva ronda estimada" : "Total estimado"}{" "}
                  <strong>
                    {money(
                      cart.reduce(
                        (sum, l) =>
                          sum +
                          (products.find((p) => p.id === l.productId)
                            ?.priceCents ?? 0) *
                            l.quantity,
                        0,
                      ),
                    )}
                  </strong>
                </p>
                <button
                  disabled={
                    disabled ||
                    (targetOrderId ? !targetOrder : !tableId) ||
                    !cart.length ||
                    cart.some(
                      (l) =>
                        !Number.isInteger(l.quantity) ||
                        l.quantity < 1 ||
                        l.quantity > 100,
                    )
                  }
                  onClick={submit}
                >
                  {targetOrderId
                    ? "Enviar nueva ronda a cocina"
                    : "Enviar a cocina"}
                </button>
              </>
            )}
          </article>
        </div>
      )}
      {!kitchen && (
        <div className="product-toolbar">
          <h2>Cuentas {orders.filter((o) => !finished(o)).length} abiertas</h2>
          <button className="secondary" onClick={() => setHistory((v) => !v)}>
            {history ? "Ver sólo abiertas" : "Ver últimas cuentas cerradas"}
          </button>
        </div>
      )}
      <div className="product-grid">
        {visible.map((order) => (
          <article
            className={`card order-card status-${order.status.toLowerCase()}`}
            key={order.id}
          >
            <div className="record-heading">
              <h3>
                #{order.number} · {order.tableName}
              </h3>
              <span className="badge">{labels[order.status]}</span>
            </div>
            <p>
              {new Date(order.createdAt).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {order.createdByName}
            </p>
            {order.rounds.length > 0 ? (
              <Rounds
                rounds={order.rounds}
                canCancel={admin && !finished(order) && !kitchen}
                totalCents={order.totalCents}
                storageKey={`tavixo-cancel-${session.restaurant.id}-${branchId}-${order.id}`}
                onCancel={async (itemId: string, body: CancelPayload) => {
                  const updated: Order = await api(
                    `orders/${order.id}/items/${itemId}/cancellations`,
                    "POST",
                    body,
                  );
                  setOrders((current) =>
                    current.map((o) => (o.id === updated.id ? updated : o)),
                  );
                  setNotice("Producto cancelado; total de cuenta actualizado");
                }}
                kitchen={kitchen}
                cook={cook}
                floor={floor}
                disabled={disabled}
                onStatus={(round, status) =>
                  void changeRound(order, round, status)
                }
              />
            ) : (
              <ul>
                {order.items.map((i) => (
                  <li key={i.id}>
                    <strong>
                      {i.quantity} × {i.name}
                    </strong>
                    <span className="line-price">
                      {money(i.unitPriceCents * i.quantity)}
                    </span>
                    {i.notes && <p className="order-note">{i.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
            {order.notes && <p className="order-note">{order.notes}</p>}
            <p className="order-total">
              Total <strong>{money(order.totalCents)}</strong>
            </p>
            <div className="actions">
              {!order.rounds.length && cook && order.status === "SENT" && (
                <button
                  disabled={disabled}
                  onClick={() => change(order, "PREPARING")}
                >
                  Comenzar preparación
                </button>
              )}
              {!order.rounds.length && cook && order.status === "PREPARING" && (
                <button
                  disabled={disabled}
                  onClick={() => change(order, "READY")}
                >
                  Marcar lista
                </button>
              )}
              {!order.rounds.length && floor && order.status === "READY" && (
                <button
                  disabled={disabled}
                  onClick={() => change(order, "DELIVERED")}
                >
                  Registrar entrega
                </button>
              )}
              {floor && !kitchen && !finished(order) && (
                <button
                  disabled={disabled || !!pending}
                  className="secondary"
                  onClick={() => {
                    setTargetOrderId(order.id);
                    composeRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Agregar productos
                </button>
              )}
              {admin && !finished(order) && (
                <button
                  className="secondary"
                  disabled={disabled}
                  onClick={() => {
                    setConfirmation({ order, status: "CANCELLED" });
                    setReason("");
                  }}
                >
                  Cancelar comanda
                </button>
              )}
            </div>
            {confirmation?.order.id === order.id && (
              <form
                className="order-confirmation"
                aria-label="Confirmar cambio de comanda"
                onSubmit={(e) => {
                  e.preventDefault();
                  void change(confirmation.order, confirmation.status, reason);
                }}
              >
                <h4>¿Cancelar esta comanda?</h4>
                <label>
                  Motivo de cancelación
                  <input
                    autoFocus
                    required
                    minLength={1}
                    maxLength={500}
                    value={reason}
                    disabled={disabled}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="actions">
                  <button disabled={disabled || !reason.trim()}>
                    Confirmar cancelación
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => setConfirmation(null)}
                  >
                    Volver
                  </button>
                </div>
              </form>
            )}
            {!kitchen && (
              <PaymentPanel
                order={order}
                canPay={canPay}
                disabled={disabled}
                api={api}
                storageKey={`tavixo-payment-${session.restaurant.id}-${branchId}-${order.id}`}
                onPaid={(next) => {
                  setOrders((current) =>
                    current.map((o) => (o.id === next.id ? next : o)),
                  );
                  setNotice(
                    `Pago de ${money(next.totalCents)} registrado. Mesa liberada.`,
                  );
                  setHistory(true);
                }}
              />
            )}
            {role !== "KITCHEN" && (
              <TicketPanel
                order={order}
                branchId={branchId}
                token={session.accessToken}
                disabled={disabled}
              />
            )}
            <details>
              <summary>Actividad</summary>
              <ul>
                {order.events.map((e) => (
                  <li key={e.id}>
                    {labels[e.status]} · {e.actorName} ·{" "}
                    {new Date(e.createdAt).toLocaleTimeString("es-MX")}
                    {e.reason && <p>{e.reason}</p>}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      {!loading && branchId && !visible.length && (
        <p>
          {kitchen
            ? "No hay pedidos pendientes en cocina."
            : "No hay cuentas abiertas."}
        </p>
      )}
    </section>
  );
}
