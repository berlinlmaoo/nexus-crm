import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const currency = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

// Color palette
const AMBER   = 'FFF59E0B';
const EMERALD = 'FF10B981';
const ROSE    = 'FFFF3B5C';
const SKY     = 'FF3B82F6';
const STONE   = 'FF6B7280';
const WHITE   = 'FFFFFFFF';
const LIGHT_AMBER  = 'FFFEF3C7';
const LIGHT_EMERALD= 'FFD1FAE5';
const LIGHT_ROSE   = 'FFFFE4E6';
const LIGHT_STONE  = 'FFF9FAFB';

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

function styleSectionTitle(row: ExcelJS.Row, bgColor: string) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.font = { bold: true, size: 12, color: { argb: '44FF6600' } };
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 24;
}

export async function GET() {
  const [productsRes, transactionsRes, posRes] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, category, price, current_stock, min_stock').order('name'),
    supabaseAdmin.from('stock_transactions').select('id, type, quantity, created_at, products:product_id(name, price, category)').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('purchase_orders').select('*, products:product_id(name, category, unit)').order('created_at', { ascending: false }),
  ]);

  const products = productsRes.data || [];
  const transactions = transactionsRes.data || [];
  const pos = posRes.data || [];

  const totalAssetValue = products.reduce((s, p) => s + p.price * p.current_stock, 0);
  const criticalItems   = products.filter(p => p.current_stock <= p.min_stock).length;
  const totalPOSpend    = pos.filter(p => p.status === 'APPROVED' || p.status === 'FULFILLED').reduce((s, p) => s + (p.total_price || 0), 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEXUS CRM';
  wb.created = new Date();

  // ──────────────────────────────────────────
  // SHEET 1: RINGKASAN
  // ──────────────────────────────────────────
  const ws1 = wb.addWorksheet('📊 Ringkasan', { views: [{ showGridLines: false }] });
  ws1.columns = [
    { key: 'a', width: 38 },
    { key: 'b', width: 28 },
    { key: 'c', width: 22 },
  ];

  // Title
  const titleRow = ws1.addRow(['NEXUS CRM — LAPORAN KEUANGAN', '', '']);
  ws1.mergeCells(`A1:C1`);
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: WHITE } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 40;

  ws1.addRow(['Tanggal Cetak', new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })]).getCell(1).font = { italic: true, color: { argb: STONE } };
  ws1.addRow([]);

  // KPI Section
  const kpiTitle = ws1.addRow(['INDIKATOR UTAMA', 'NILAI']);
  styleHeaderRow(kpiTitle, AMBER);

  const kpis = [
    ['Total Nilai Aset Stok', currency(totalAssetValue)],
    ['Total Belanja PO (Disetujui)', currency(totalPOSpend)],
    ['Item Stok Kritis', `${criticalItems} item`],
    ['Total Produk Terdaftar', `${products.length} produk`],
    ['Total Transaksi Stok', `${transactions.length} transaksi`],
  ];
  kpis.forEach((kpi, i) => {
    const row = ws1.addRow(kpi);
    styleDataRow(row, i % 2 === 0);
    row.getCell(2).font = { bold: true };
  });

  ws1.addRow([]);

  // Category Section
  const catHeader = ws1.addRow(['KATEGORI', 'JUMLAH ITEM', 'NILAI ASET']);
  styleHeaderRow(catHeader, STONE);

  const categoryMap: Record<string, { count: number; value: number }> = {};
  products.forEach(p => {
    const c = p.category || 'Lainnya';
    if (!categoryMap[c]) categoryMap[c] = { count: 0, value: 0 };
    categoryMap[c].count += 1;
    categoryMap[c].value += p.price * p.current_stock;
  });
  Object.entries(categoryMap).sort(([,a],[,b]) => b.value - a.value).forEach(([cat, data], i) => {
    const row = ws1.addRow([cat, data.count, currency(data.value)]);
    styleDataRow(row, i % 2 === 0);
  });

  // ──────────────────────────────────────────
  // SHEET 2: DATA STOK
  // ──────────────────────────────────────────
  const ws2 = wb.addWorksheet('📦 Data Stok', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws2.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Produk', key: 'name', width: 42 },
    { header: 'Kategori', key: 'cat', width: 20 },
    { header: 'Stok Saat Ini', key: 'stock', width: 15 },
    { header: 'Min. Stok', key: 'min', width: 12 },
    { header: 'Harga Satuan', key: 'price', width: 22 },
    { header: 'Nilai Aset', key: 'value', width: 24 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  styleHeaderRow(ws2.getRow(1), EMERALD);

  products.sort((a, b) => (b.price * b.current_stock) - (a.price * a.current_stock)).forEach((p, i) => {
    const isKritis = p.current_stock <= p.min_stock;
    const row = ws2.addRow({
      no: i + 1, name: p.name, cat: p.category,
      stock: p.current_stock, min: p.min_stock,
      price: currency(p.price), value: currency(p.price * p.current_stock),
      status: isKritis ? 'KRITIS' : 'AMAN',
    });
    styleDataRow(row, i % 2 === 0);
    // Color status cell
    const statusCell = row.getCell(8);
    if (isKritis) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROSE } };
      statusCell.font = { bold: true, color: { argb: 'FFBE123C' } };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_EMERALD } };
      statusCell.font = { bold: true, color: { argb: 'FF065F46' } };
    }
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ──────────────────────────────────────────
  // SHEET 3: PURCHASE ORDERS
  // ──────────────────────────────────────────
  const ws3 = wb.addWorksheet('🛒 Purchase Orders', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws3.columns = [
    { header: 'No. PO', key: 'po', width: 24 },
    { header: 'Produk', key: 'product', width: 38 },
    { header: 'Kategori', key: 'cat', width: 18 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Harga Satuan', key: 'unit', width: 22 },
    { header: 'Total Harga', key: 'total', width: 22 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Tanggal', key: 'date', width: 15 },
  ];
  styleHeaderRow(ws3.getRow(1), SKY);

  const statusColors: Record<string, { bg: string; fg: string }> = {
    APPROVED:        { bg: LIGHT_EMERALD, fg: '0059FFBE' },
    FULFILLED:       { bg: 'FFE0E7FF', fg: '003730B3' },
    REJECTED:        { bg: LIGHT_ROSE, fg: '00BE123C' },
    PENDING_MANAGER: { bg: LIGHT_AMBER, fg: '00B45309' },
    PENDING_OWNER:   { bg: 'FFE0F2FE', fg: '000284c7' },
  };

  pos.forEach((p: any, i) => {
    const row = ws3.addRow({
      po: p.po_number, product: p.products?.name || '—', cat: p.products?.category || '—',
      qty: p.quantity,
      unit: p.unit_price ? currency(p.unit_price) : '—',
      total: p.total_price ? currency(p.total_price) : '—',
      status: p.status,
      date: p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '—',
    });
    styleDataRow(row, i % 2 === 0);
    const sc = statusColors[p.status];
    if (sc) {
      const statusCell = row.getCell(7);
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
      statusCell.font = { bold: true };
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // ──────────────────────────────────────────
  // SHEET 4: RIWAYAT STOK
  // ──────────────────────────────────────────
  const ws4 = wb.addWorksheet('🔄 Riwayat Stok', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws4.columns = [
    { header: 'Waktu', key: 'time', width: 22 },
    { header: 'Produk', key: 'product', width: 38 },
    { header: 'Kategori', key: 'cat', width: 18 },
    { header: 'Jenis', key: 'type', width: 14 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Harga Satuan', key: 'price', width: 22 },
    { header: 'Total Nilai', key: 'value', width: 22 },
  ];
  styleHeaderRow(ws4.getRow(1), STONE);

  const typeColors: Record<string, { bg: string; fg: string }> = {
    IN:         { bg: LIGHT_EMERALD, fg: '00065F46' },
    OUT:        { bg: 'FFE0F2FE', fg: '000369A1' },
    WASTE:      { bg: LIGHT_ROSE, fg: '00BE123C' },
    ADJUSTMENT: { bg: LIGHT_AMBER, fg: '00B45309' },
    OPNAME:     { bg: 'FFE0E7FF', fg: '003730B3' },
  };

  transactions.forEach((tx: any, i) => {
    const price = tx.products?.price || 0;
    const row = ws4.addRow({
      time: tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '—',
      product: tx.products?.name || '—',
      cat: tx.products?.category || '—',
      type: tx.type,
      qty: tx.quantity,
      price: currency(price),
      value: currency(tx.quantity * price),
    });
    styleDataRow(row, i % 2 === 0);
    const tc = typeColors[tx.type];
    if (tc) {
      const typeCell = row.getCell(4);
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tc.bg } };
      typeCell.font = { bold: true };
      typeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // ──────────────────────────────────────────
  // GENERATE BUFFER & RETURN
  // ──────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `NEXUS-Finance-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
