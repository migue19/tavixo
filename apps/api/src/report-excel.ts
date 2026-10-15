import ExcelJS from "exceljs";
import { ReportsService } from "./reports.service";
import { restaurantBranding } from "./branding";

type Sales = Awaited<ReturnType<ReportsService["sales"]>>;
const currency = '"$"#,##0.00;[Red]-"$"#,##0.00';
export async function salesExcel(report: Sales): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Tavixo";
  book.created = new Date(report.generatedAt);
  const brand = restaurantBranding(report.restaurant.slug);
  const dark = brand?.primary.slice(1) ?? "123C35";
  const accent = brand?.accent.slice(1) ?? "C98546";
  function sheet(name: string, headers: string[], widths: number[]) {
    const ws = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 6 }] });
    ws.columns = widths.map(width => ({ width }));
    for (const [row, text] of [
      [1, report.restaurant.name],
      [2, `${report.branch.name} · ${report.from} al ${report.to}`],
      [3, "Moneda: MXN · Zona horaria: America/Mexico_City"],
      [4, `Generado: ${new Date(report.generatedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`],
    ] as const) {
      ws.mergeCells(row, 1, row, headers.length);
      ws.getCell(row, 1).value = text; // Strings stay strings, including names starting with =.
      ws.getRow(row).height = row === 1 ? 30 : 24;
      ws.getCell(row, 1).alignment = { wrapText: true, vertical: "middle" };
    }
    ws.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF" + accent } };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + dark } };
    ws.getRow(6).values = headers;
    ws.getRow(6).height = 28;
    ws.getRow(6).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + dark } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    ws.headerFooter.oddFooter = "Tecnología Tavixo · Página &P de &N";
    return ws;
  }
  const summary = sheet("Resumen", ["Indicador", "Valor"], [48, 68]);
  const metrics: [string, string | number, boolean?][] = [
    ["Ventas cobradas", report.totalCents / 100, true],
    ["Cuentas cobradas", report.paymentCount],
    ["Ticket promedio", report.averageTicketCents / 100, true],
    ["Efectivo neto", report.cashCents / 100, true],
    ["Tarjeta", report.cardCents / 100, true],
    ["Cuentas con pago mixto", report.mixedCount],
    ["Unidades vendidas", report.unitsSold],
    ["Venta por productos", report.productSalesCents / 100, true],
    ["Diferencia cobros menos productos", (report.totalCents - report.productSalesCents) / 100, true],
    ["Alcance", "Sólo cuentas cobradas; excluye abiertas, canceladas y cerradas sin pago."],
    ["Caja", "Fondo inicial, retiros y gastos se consultan en Turnos de caja."],
    ["Productos", "Incluye todos los renglones. Nombres y precios históricos; unidades canceladas excluidas."],
  ];
  metrics.forEach(([label, value, monetary]) => {
    const row = summary.addRow([label, value]);
    if (monetary) row.getCell(2).numFmt = currency;
    row.getCell(2).alignment = { wrapText: true, vertical: "middle" };
    row.height = typeof value === "string" ? 36 : 24;
  });
  const daily = sheet("Ventas por día", ["Fecha", "Cuentas", "Efectivo (MXN)", "Tarjeta (MXN)", "Total (MXN)"], [20, 14, 22, 22, 22]);
  report.daily.forEach(d => daily.addRow([new Date(`${d.day}T00:00:00Z`), d.paymentCount, d.cashCents / 100, d.cardCents / 100, d.totalCents / 100]));
  daily.getColumn(1).numFmt = "yyyy-mm-dd";
  for (const col of [3, 4, 5]) daily.getColumn(col).numFmt = currency;
  daily.autoFilter = { from: "A6", to: `E${daily.rowCount}` };
  const products = sheet("Productos más vendidos", ["Producto", "Unidades", "Venta (MXN)", "ID de producto"], [62, 16, 24, 40]);
  report.products.forEach(p => {
    const row = products.addRow([p.name, p.quantity, p.totalCents / 100, p.productId]);
    row.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    row.height = 32;
  });
  products.getColumn(3).numFmt = currency;
  if (report.products.length) products.autoFilter = { from: "A6", to: `D${products.rowCount}` };
  else products.getCell("A7").value = "Sin productos cobrados en este período";
  return Buffer.from(await book.xlsx.writeBuffer());
}
