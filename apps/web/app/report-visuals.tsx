"use client";

const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
const axisMoney = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

type VisualReport = {
  totalCents: number;
  cashCents: number;
  cardCents: number;
  unitsSold: number;
  mixedCount: number;
  daily: { day: string; totalCents: number }[];
  products: { productId: string; name: string; quantity: number; totalCents: number }[];
};

export default function ReportVisuals({ report }: { report: VisualReport }) {
  const bestDay = report.daily.reduce<(typeof report.daily)[number] | null>(
    (best, day) => !best || day.totalCents > best.totalCents ? day : best, null,
  );
  const max = Math.max(1, ...report.daily.map((day) => day.totalCents));
  const points = report.daily.map((day, index) => ({
    ...day,
    x: report.daily.length === 1 ? 380 : 95 + index * 570 / (report.daily.length - 1),
    y: 205 - day.totalCents / max * 165,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const cashShare = report.totalCents > 0 ? report.cashCents / report.totalCents * 100 : 0;
  const products = report.products.slice(0, 5);
  const topQuantity = Math.max(1, ...products.map((product) => product.quantity));
  const hasSales = report.totalCents > 0;

  return (
    <div className="report-visuals">
      <div className="report-highlights">
        <article>
          <span>Día de mayor venta</span>
          <strong>{hasSales && bestDay ? dateLabel(bestDay.day) : "Sin ventas"}</strong>
          <small>{hasSales && bestDay ? money(bestDay.totalCents) : "No hay cobros en el período"}</small>
        </article>
        <article>
          <span>Promedio por día</span>
          <strong>{money(report.daily.length ? Math.round(report.totalCents / report.daily.length) : 0)}</strong>
          <small>Incluye días sin cobros del período</small>
        </article>
        <article>
          <span>Productos vendidos</span>
          <strong>{report.unitsSold.toLocaleString("es-MX")}</strong>
          <small>Unidades cobradas, sin cancelaciones</small>
        </article>
      </div>
      <div className="report-chart-grid">
        <article className="card sales-trend">
          <div className="chart-heading"><div><p className="eyebrow">TU VENTA A LO LARGO DEL TIEMPO</p><h3>Ventas por día</h3></div><span className="chart-key">Ventas cobradas</span></div>
          {hasSales && points.length ? (
            <>
              <svg className="daily-sales-chart" viewBox="0 0 700 260" role="img" aria-label={`Ventas diarias en pesos mexicanos. Total ${money(report.totalCents)}. Día de mayor venta: ${bestDay ? `${dateLabel(bestDay.day)}, ${money(bestDay.totalCents)}` : "sin datos"}. Consulta los valores exactos en la tabla de ventas por día.`}>
                {[0, 0.5, 1].map((fraction) => (
                  <g key={fraction}>
                    <line x1="95" x2="665" y1={205 - fraction * 165} y2={205 - fraction * 165} stroke="#dce4da" strokeDasharray="4 5" />
                    <text x="82" y={210 - fraction * 165} textAnchor="end">{axisMoney(Math.round(max * fraction))}</text>
                  </g>
                ))}
                <polygon points={`${points[0].x},205 ${line} ${points[points.length - 1].x},205`} fill="var(--brand-surface, #e5eee0)" />
                <polyline points={line} fill="none" stroke="var(--brand-primary, #286a52)" strokeWidth="3" strokeLinejoin="round" />
                {points.map((point) => (
                  <circle key={point.day} cx={point.x} cy={point.y} r={points.length <= 31 ? 4 : 2} fill="var(--brand-primary, #286a52)"><title>{`${point.day}: ${money(point.totalCents)}`}</title></circle>
                ))}
                {[...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((index) => (
                  <text key={index} x={points[index].x} y="239" textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{dateLabel(points[index].day)}</text>
                ))}
              </svg>
              <p className="chart-caption">Cada punto representa un día del período. Importes en MXN; detalle exacto en la tabla inferior.</p>
            </>
          ) : <div className="chart-empty"><strong>Aún no hay ventas cobradas</strong><p>Al registrar cobros en este período, aquí verás cómo avanzan tus ventas.</p></div>}
        </article>
        <article className="card payment-mix">
          <p className="eyebrow">CÓMO TE PAGARON</p><h3>Efectivo y tarjeta</h3>
          <div className="payment-donut" role="img" aria-label={hasSales ? `Efectivo ${cashShare.toFixed(1)}%, tarjeta ${(100 - cashShare).toFixed(1)}%.` : "Sin cobros en el período"} style={{ background: hasSales ? `conic-gradient(var(--brand-primary, #286a52) 0% ${cashShare}%, var(--brand-accent, #bd743c) ${cashShare}% 100%)` : "#e0e6dd" }}>
            <div><strong>{hasSales ? "100%" : "0"}</strong><span>{hasSales ? "de tus cobros" : "cobros"}</span></div>
          </div>
          <dl className="payment-legend">
            <div><dt><span className="legend-dot cash-dot" />Efectivo</dt><dd><strong>{money(report.cashCents)}</strong><small>{cashShare.toFixed(1)}%</small></dd></div>
            <div><dt><span className="legend-dot card-dot" />Tarjeta</dt><dd><strong>{money(report.cardCents)}</strong><small>{hasSales ? (100 - cashShare).toFixed(1) : "0.0"}%</small></dd></div>
          </dl>
          <p className="chart-caption">Los pagos mixtos se reparten entre efectivo y tarjeta. {report.mixedCount} cuentas con pago mixto.</p>
        </article>
      </div>
      <article className="card top-products-chart">
        <p className="eyebrow">LOS FAVORITOS DEL PERÍODO</p><h3>Los 5 productos más vendidos</h3>
        <p>Ordenados por unidades cobradas. El importe muestra cuánto vendiste de cada producto.</p>
        {!products.length ? <p>No hay productos cobrados en este período.</p> : (
          <ol className="product-ranking">
            {products.map((product, index) => (
              <li key={`${product.productId}-${product.name}`}>
                <span className="ranking-position" aria-hidden="true">{index + 1}</span>
                <div className="ranking-product"><div className="ranking-label"><strong>{product.name}</strong><span>{product.quantity.toLocaleString("es-MX")} unidades · {money(product.totalCents)}</span></div><div className="ranking-track" aria-hidden="true"><div style={{ width: `${product.quantity / topQuantity * 100}%` }} /></div></div>
              </li>
            ))}
          </ol>
        )}
      </article>
    </div>
  );
}
