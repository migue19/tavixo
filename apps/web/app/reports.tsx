"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "./management";
import ReportVisuals from "./report-visuals";
type Branch = { id: string; name: string; active: boolean };
type Report = {
  from: string;
  to: string;
  branch: { name: string };
  periodEnd: string;
  paymentCount: number;
  totalCents: number;
  cashCents: number;
  cardCents: number;
  mixedCount: number;
  averageTicketCents: number;
  unitsSold: number;
  productCount: number;
  productLimit: number;
  productSalesCents: number;
  daily: {
    day: string;
    paymentCount: number;
    totalCents: number;
    cashCents: number;
    cardCents: number;
  }[];
  products: {
    productId: string;
    name: string;
    quantity: number;
    totalCents: number;
  }[];
};
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export default function Reports({
  session,
  branches,
  online,
}: {
  session: Session;
  branches: Branch[];
  online: boolean;
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? "");
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`),
    [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const sequence = useRef(0);
  async function downloadExcel() {
    if (!report || loading || !online || exporting) return;
    const version = sequence.current;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(`/api/restaurant/branches/${branch}/reports/sales.xlsx?${new URLSearchParams({ from: report.from, to: report.to })}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(typeof data.message === "string" ? data.message : "No se pudo descargar el Excel");
      }
      const blob = await response.blob();
      if (version !== sequence.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tavixo-ventas-${branch}-${report.from}-${report.to}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      if (version === sequence.current) setExportError(e instanceof Error ? e.message : "Revisa tu conexión");
    } finally { setExporting(false); }
  }
  useEffect(() => {
    if (!branches.some((b) => b.id === branch))
      setBranch(branches[0]?.id ?? "");
  }, [branches, branch]);
  const load = useCallback(async () => {
    const version = ++sequence.current;
    setReport(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(
        `/api/restaurant/branches/${branch}/reports/sales?${new URLSearchParams({ from, to })}`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? "Revisa las fechas del reporte"
            : (data.message ?? "No se pudo consultar el reporte"),
        );
      if (sequence.current === version) setReport(data);
    } catch (e) {
      if (sequence.current === version)
        setError(e instanceof Error ? e.message : "Revisa la conexión");
    } finally {
      if (sequence.current === version) setLoading(false);
    }
  }, [branch, from, to, session.accessToken]);
  useEffect(() => {
    setReport(null);
    setError("");
    setExportError("");
    if (branch && online) void load();
    else setLoading(false);
    return () => {
      sequence.current++;
    };
  }, [load, branch, online]);
  return (
    <section className="sales-reports">
      <h2>Reportes de ventas</h2>
      <p>
        Ventas cobradas por sucursal y fecha de cobro, en horario de México.
        Selecciona hasta 366 días.
      </p>
      <div className="field-row">
        <label>
          Sucursal
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.active ? "" : " · Inactiva"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            min="2000-01-01"
            max={today()}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            min="2000-01-01"
            max={today()}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          disabled={loading || !online || !branch}
          onClick={() => void load()}
        >
          Actualizar reporte
        </button>
      </div>
      {!online && (
        <p className="alert">Conéctate para consultar los reportes.</p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Cargando reporte…</p>}
      {report && (
        <>
          <p>
            {report.branch.name} · {report.from} al {report.to} · Incluye cobros
            hasta{" "}
            {new Date(report.periodEnd).toLocaleString("es-MX", {
              timeZone: "America/Mexico_City",
            })}
            .
          </p>
          <article className="card report-download">
            <div><h3>Descargar reportes</h3>
              <p>Excel con resumen, ventas por día y todos los productos vendidos de {report.branch.name}, del {report.from} al {report.to}.</p>
              <small>Importes en MXN. Se consultan los cobros al generar el archivo; pueden incluir ventas registradas después de cargar esta pantalla.</small>
            </div>
            <button disabled={exporting || loading || !online} onClick={() => void downloadExcel()}>{exporting ? "Preparando Excel…" : "Descargar Excel"}</button>
            {exportError && <p className="alert" role="alert">{exportError}</p>}
          </article>
          <div className="stats">
            <article className="card">
              <span>Ventas cobradas</span>
              <strong>{money(report.totalCents)}</strong>
            </article>
            <article className="card">
              <span>Cuentas cobradas</span>
              <strong>{report.paymentCount}</strong>
            </article>
            <article className="card">
              <span>Ticket promedio</span>
              <strong>{money(report.averageTicketCents)}</strong>
            </article>
          </div>
          <p>
            Efectivo {money(report.cashCents)} · Tarjeta{" "}
            {money(report.cardCents)} · {report.mixedCount} cuentas con pago
            mixto · {report.unitsSold} productos vendidos.
          </p>
          <p>
            Las cuentas abiertas, canceladas y cerradas sin pago quedan fuera.
            El efectivo es venta neta después del cambio; fondo inicial, retiros
            y gastos se consultan en Turnos de caja.
          </p>
          <ReportVisuals report={report} />
          <article className="card">
            <h3>Detalle de ventas por día</h3>
            <div className="cash-table">
              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Cuentas</th>
                    <th>Efectivo</th>
                    <th>Tarjeta</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td>{d.paymentCount}</td>
                      <td>{money(d.cashCents)}</td>
                      <td>{money(d.cardCents)}</td>
                      <td>{money(d.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="card">
            <h3>Productos más vendidos</h3>
            <p>
              Ordenados por unidades vendidas, luego por importe. Precios y
              nombres registrados en la cuenta; las unidades canceladas no se
              incluyen. Los cambios de nombre aparecen en renglones separados.
            </p>
            {report.productCount > report.productLimit && (
              <p>
                Se muestran los primeros {report.productLimit} de{" "}
                {report.productCount} renglones. Los totales incluyen todos.
              </p>
            )}
            {report.productSalesCents !== report.totalCents && (
              <p className="alert">
                El detalle de productos suma {money(report.productSalesCents)} y
                difiere de los cobros. Revisa los registros históricos.
              </p>
            )}
            {!report.products.length ? (
              <p>No hay productos cobrados en este período.</p>
            ) : (
              <div className="cash-table">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th>Venta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.products.map((p) => (
                      <tr key={`${p.productId}-${p.name}`}>
                        <td>{p.name}</td>
                        <td>{p.quantity}</td>
                        <td>{money(p.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
