import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Fetch all data needed for finance report
  const [productsRes, transactionsRes, posRes] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, category, price, current_stock, min_stock'),
    supabaseAdmin
      .from('stock_transactions')
      .select('id, type, quantity, created_at, products:product_id(name, price, category)')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('purchase_orders')
      .select('id, quantity, unit_price, total_price, status, created_at, products:product_id(name, category)')
      .order('created_at', { ascending: true }),
  ]);

  const products = productsRes.data || [];
  const transactions = transactionsRes.data || [];
  const pos = posRes.data || [];

  // --- KPI Calculations ---
  const totalAssetValue = products.reduce((sum, p) => sum + (p.price * p.current_stock), 0);
  const criticalItems = products.filter(p => p.current_stock <= p.min_stock).length;
  const totalApprovedPOSpend = pos
    .filter(p => p.status === 'APPROVED' || p.status === 'FULFILLED')
    .reduce((sum, p) => sum + (p.total_price || 0), 0);
  const totalTransactions = transactions.length;

  // --- Asset by Category ---
  const categoryMap: Record<string, { value: number; count: number }> = {};
  products.forEach(p => {
    const cat = p.category || 'Lainnya';
    if (!categoryMap[cat]) categoryMap[cat] = { value: 0, count: 0 };
    categoryMap[cat].value += p.price * p.current_stock;
    categoryMap[cat].count += 1;
  });
  const assetByCategory = Object.entries(categoryMap).map(([name, data]) => ({
    name,
    value: data.value,
    count: data.count,
  })).sort((a, b) => b.value - a.value);

  // --- Transaction Trend (last 30 days, grouped by date) ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const txByDay: Record<string, { date: string; IN: number; OUT: number; WASTE: number }> = {};
  
  // Initialize last 14 days
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    txByDay[key] = { date: key, IN: 0, OUT: 0, WASTE: 0 };
  }

  transactions.forEach((tx: any) => {
    const dateKey = tx.created_at?.slice(0, 10);
    if (dateKey && txByDay[dateKey]) {
      const price = tx.products?.price || 0;
      const val = tx.quantity * price;
      if (tx.type === 'IN') txByDay[dateKey].IN += val;
      else if (tx.type === 'OUT') txByDay[dateKey].OUT += val;
      else if (tx.type === 'WASTE') txByDay[dateKey].WASTE += val;
    }
  });

  const transactionTrend = Object.values(txByDay).map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
  }));

  // --- PO Spend by Month ---
  const poByMonth: Record<string, number> = {};
  pos.filter(p => p.total_price && (p.status === 'APPROVED' || p.status === 'FULFILLED')).forEach(p => {
    const month = p.created_at?.slice(0, 7); // YYYY-MM
    if (month) {
      poByMonth[month] = (poByMonth[month] || 0) + (p.total_price || 0);
    }
  });
  const poTrend = Object.entries(poByMonth).map(([month, total]) => ({
    month: new Date(month + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
    total
  })).slice(-6); // last 6 months

  // --- Top 10 Products by Value (for chart) ---
  const topProducts = products
    .map(p => ({ name: p.name, value: p.price * p.current_stock, stock: p.current_stock, price: p.price }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // --- All Products (for full Excel export) ---
  const allProducts = products
    .map(p => ({
      name: p.name,
      category: p.category,
      stock: p.current_stock,
      minStock: p.min_stock,
      price: p.price,
      value: p.price * p.current_stock,
      status: p.current_stock <= p.min_stock ? 'KRITIS' : 'AMAN',
    }))
    .sort((a, b) => b.value - a.value);

  // --- All POs (for full Excel export) ---
  const allPos = pos.map((p: any) => ({
    poNumber: p.po_number || '',
    product: p.products?.name || '',
    category: p.products?.category || '',
    quantity: p.quantity,
    unitPrice: p.unit_price || 0,
    totalPrice: p.total_price || 0,
    status: p.status || '',
    date: p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '',
  }));

  // --- All Transactions (for full Excel export, last 100) ---
  const allTransactions = (transactionsRes.data || []).slice(-100).map((tx: any) => ({
    date: tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '',
    product: tx.products?.name || '',
    category: tx.products?.category || '',
    type: tx.type,
    quantity: tx.quantity,
    unitPrice: tx.products?.price || 0,
    totalValue: tx.quantity * (tx.products?.price || 0),
  }));

  return NextResponse.json({
    kpis: { totalAssetValue, criticalItems, totalApprovedPOSpend, totalTransactions },
    assetByCategory,
    transactionTrend,
    poTrend,
    topProducts,
    allProducts,
    allPos,
    allTransactions,
  });
}
