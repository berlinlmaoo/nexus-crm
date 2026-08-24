import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { buildFinanceReport, parseFinanceParams, asNumber } from '@/lib/finance-report';
import { requireRole } from '@/lib/api-auth';

const currency = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
const percent = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;

const RANGE_LABEL: Record<string, string> = { '30d': '30 Hari', '90d': '90 Hari', '180d': '180 Hari', '365d': '1 Tahun' };
const GRAN_LABEL: Record<string, string> = { day: 'Harian', week: 'Mingguan', month: 'Bulanan' };

// Color palette
const AMBER   = 'FFF59E0B';
const EMERALD = 'FF10B981';
const ROSE    = 'FFFF3B5C';
const SKY     = 'FF3B82F6';
const VIOLET  = 'FF8B5CF6';
const STONE   = 'FF6B7280';
const WHITE   = 'FFFFFFFF';
const LIGHT_EMERALD = 'FFD1FAE5';
const LIGHT_ROSE    = 'FFFFE4E6';

function styleHeaderRow(row: ExcelJS.Row, bgColor: string) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'medium', color: { argb: WHITE } },
      right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };
  });
  row.height = 28;
}

function styleDataRow(row: ExcelJS.Row, zebra: boolean) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra ? 'FFF9F9F9' : WHITE } };
    cell.alignment = { vertical: 'middle' };
    cell.border = {
      top:    { style: 'hair', color: { argb: 'FFEEEEEE' } },
      bottom: { style: 'hair', color: { argb: 'FFEEEEEE' } },
      left:   { style: 'hair', color: { argb: 'FFEEEEEE' } },
      right:  { style: 'hair', color: { argb: 'FFEEEEEE' } },
    };
  });
  row.height = 20;
}

export async function GET(request: Request) {
  // Sama kayak /api/report/finance — ini versi Excel-nya, isinya persis sama.
  const { error: authError } = await requireRole(['OWNER', 'MANAGER']);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const { range, granularity } = parseFinanceParams(searchParams);

  const result = await buildFinanceReport(range, granularity);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { meta, kpis, trend, byStore, stockByCategory } = result.report;
  const { orders, products } = result.raw;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEXUS CRM';
  wb.created = new Date();

  // ──────────────────────────────────────────
  // SHEET 1: RINGKASAN
  // ──────────────────────────────────────────
  const ws1 = wb.addWorksheet('📊 Ringkasan', { views: [{ showGridLines: false }] });
  ws1.columns = [{ key: 'a', width: 38 }, { key: 'b', width: 26 }, { key: 'c', width: 22 }];

  const titleRow = ws1.addRow(['NEXUS CRM — DASHBOARD FINANCE', '', '']);
  ws1.mergeCells('A1:C1');
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 40;

  ws1.addRow(['Periode', `${RANGE_LABEL[range] || range} • ${GRAN_LABEL[granularity] || granularity}`]).getCell(1).font = { italic: true, color: { argb: STONE } };
  ws1.addRow(['Sejak', new Date(meta.startDate).toLocaleDateString('id-ID', { dateStyle: 'full' })]).getCell(1).font = { italic: true, color: { argb: STONE } };
  ws1.addRow(['Tanggal Cetak', new Date(meta.generatedAt).toLocaleString('id-ID')]).getCell(1).font = { italic: true, color: { argb: STONE } };
  ws1.addRow([]);

  const kpiHeader = ws1.addRow(['INDIKATOR UTAMA', 'NILAI']);
  styleHeaderRow(kpiHeader, AMBER);

  const kpiRows: [string, string][] = [
    ['Gross Sales (Olsera)', currency(kpis.grossSales)],
    ['Net Collected', currency(kpis.netSales)],
    ['Total Diskon', currency(kpis.discounts)],
    ['Pajak & Service Charge', currency(kpis.taxAndService)],
    ['Jumlah Order', `${kpis.orderCount.toLocaleString('id-ID')} order`],
    ['Rata-rata per Order (AOV)', currency(kpis.averageOrderValue)],
    ['COGS Estimasi (Nexus)', currency(kpis.cogsEstimate)],
    ['  — Stock OUT Value', currency(kpis.stockOutValue)],
    ['  — Waste Value', currency(kpis.wasteValue)],
    ['Gross Profit Estimasi', currency(kpis.grossProfitEstimate)],
    ['Gross Margin', percent(kpis.grossMargin)],
    ['Nilai Stok Saat Ini', currency(kpis.stockAssetValue)],
    ['Item Stok Kritis', `${kpis.criticalItems.toLocaleString('id-ID')} item`],
    ['Total Produk', `${kpis.productCount.toLocaleString('id-ID')} produk`],
    ['Transaksi Stok (periode)', `${kpis.stockTransactionCount.toLocaleString('id-ID')} transaksi`],
    ['Belanja PO Disetujui', currency(kpis.approvedPurchaseValue)],
  ];
  kpiRows.forEach((kpi, i) => {
    const row = ws1.addRow(kpi);
    styleDataRow(row, i % 2 === 0);
    row.getCell(2).font = { bold: true };
  });

  ws1.addRow([]);

  // Per-outlet
  const outletHeader = ws1.addRow(['OUTLET / APP', 'NET SALES', 'ORDER']);
  styleHeaderRow(outletHeader, EMERALD);
  byStore.forEach((s: any, i: number) => {
    const row = ws1.addRow([s.name, currency(s.netSales), s.orders]);
    styleDataRow(row, i % 2 === 0);
  });

  ws1.addRow([]);

  // Per-category stock value
  const catHeader = ws1.addRow(['KATEGORI', 'JUMLAH ITEM', 'NILAI STOK']);
  styleHeaderRow(catHeader, STONE);
  stockByCategory.forEach((c: any, i: number) => {
    const row = ws1.addRow([c.name, c.items, currency(c.stockValue)]);
    styleDataRow(row, i % 2 === 0);
  });

  // ──────────────────────────────────────────
  // SHEET 2: PENJUALAN PER PERIODE
  // ──────────────────────────────────────────
  const ws2 = wb.addWorksheet('📈 Penjualan', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws2.columns = [
    { header: 'Periode', key: 'label', width: 16 },
    { header: 'Gross Sales', key: 'gross', width: 20 },
    { header: 'Net Collected', key: 'net', width: 20 },
    { header: 'Diskon', key: 'disc', width: 18 },
    { header: 'Order', key: 'orders', width: 10 },
    { header: 'COGS Est.', key: 'cogs', width: 20 },
    { header: 'Gross Profit', key: 'profit', width: 20 },
    { header: 'Margin', key: 'margin', width: 12 },
  ];
  styleHeaderRow(ws2.getRow(1), SKY);
  trend.forEach((t: any, i: number) => {
    const row = ws2.addRow({
      label: t.label,
      gross: currency(t.grossSales),
      net: currency(t.netSales),
      disc: currency(t.discounts),
      orders: t.orders,
      cogs: currency(t.cogsEstimate),
      profit: currency(t.grossProfitEstimate),
      margin: percent(t.margin),
    });
    styleDataRow(row, i % 2 === 0);
    const profitCell = row.getCell(7);
    profitCell.font = { bold: true, color: { argb: t.grossProfitEstimate >= 0 ? 'FF065F46' : 'FFBE123C' } };
  });

  // ──────────────────────────────────────────
  // SHEET 3: SALES ORDERS (raw)
  // ──────────────────────────────────────────
  const MAX_ORDERS = 5000;
  const ws3 = wb.addWorksheet('🧾 Sales Orders', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws3.columns = [
    { header: 'Tanggal', key: 'date', width: 20 },
    { header: 'Outlet/App', key: 'app', width: 18 },
    { header: 'No. Order', key: 'no', width: 20 },
    { header: 'Gross', key: 'gross', width: 16 },
    { header: 'Diskon', key: 'disc', width: 14 },
    { header: 'Pajak', key: 'tax', width: 14 },
    { header: 'Service', key: 'svc', width: 14 },
    { header: 'Net', key: 'net', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
  ];
  styleHeaderRow(ws3.getRow(1), VIOLET);
  orders.slice(0, MAX_ORDERS).forEach((o: any, i: number) => {
    const row = ws3.addRow({
      date: o.order_date ? new Date(o.order_date).toLocaleString('id-ID') : '—',
      app: o.app_name || o.store_name || '—',
      no: o.order_no || '—',
      gross: currency(asNumber(o.gross_amount)),
      disc: currency(asNumber(o.discount_amount)),
      tax: currency(asNumber(o.tax_amount)),
      svc: currency(asNumber(o.service_charge_amount)),
      net: currency(asNumber(o.net_amount)),
      status: o.status || '—',
    });
    styleDataRow(row, i % 2 === 0);
  });
  if (orders.length > MAX_ORDERS) {
    const note = ws3.addRow({ date: `… ${orders.length - MAX_ORDERS} order lagi tidak ditampilkan (batas ${MAX_ORDERS}).` });
    note.getCell(1).font = { italic: true, color: { argb: STONE } };
  }

  // ──────────────────────────────────────────
  // SHEET 4: DATA STOK (semua produk)
  // ──────────────────────────────────────────
  const ws4 = wb.addWorksheet('📦 Data Stok', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws4.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Produk', key: 'name', width: 42 },
    { header: 'Kategori', key: 'cat', width: 20 },
    { header: 'Stok', key: 'stock', width: 12 },
    { header: 'Min. Stok', key: 'min', width: 12 },
    { header: 'Harga', key: 'price', width: 18 },
    { header: 'Nilai Stok', key: 'value', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  styleHeaderRow(ws4.getRow(1), EMERALD);
  [...products]
    .sort((a: any, b: any) => (asNumber(b.price) * asNumber(b.current_stock)) - (asNumber(a.price) * asNumber(a.current_stock)))
    .forEach((p: any, i: number) => {
      const isKritis = asNumber(p.current_stock) <= asNumber(p.min_stock);
      const row = ws4.addRow({
        no: i + 1, name: p.name, cat: p.category,
        stock: asNumber(p.current_stock), min: asNumber(p.min_stock),
        price: currency(asNumber(p.price)), value: currency(asNumber(p.price) * asNumber(p.current_stock)),
        status: isKritis ? 'KRITIS' : 'AMAN',
      });
      styleDataRow(row, i % 2 === 0);
      const statusCell = row.getCell(8);
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isKritis ? LIGHT_ROSE : LIGHT_EMERALD } };
      statusCell.font = { bold: true, color: { argb: isKritis ? 'FFBE123C' : 'FF065F46' } };
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

  // ──────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `NEXUS-Finance-Report-${meta.generatedAt.slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
