import { createClient } from '@supabase/supabase-js';

// Shared finance-report builder used by BOTH the finance API (JSON dashboard)
// and the Excel export route, so the two never drift apart.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAY_MS = 24 * 60 * 60 * 1000;

export type Granularity = 'day' | 'week' | 'month';

export type SalesOrder = {
  app_name: string | null;
  store_name?: string | null;
  order_no?: string | null;
  order_date: string | null;
  customer_name?: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  discount_amount: number | null;
  service_charge_amount: number | null;
  tax_amount: number | null;
  status?: string | null;
};

export type StockTransaction = {
  type: string;
  quantity: number;
  created_at: string | null;
  products?: {
    name?: string | null;
    category?: string | null;
    price?: number | null;
  } | null;
};

export const asNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function fetchAllPages<T>(
  makeQuery: () => any,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...((data || []) as T[]));
    if (!data || data.length < pageSize) break;
  }

  return { data: rows, error: null };
}

const dayKey = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
const monthKey = (value: string | Date) => new Date(value).toISOString().slice(0, 7);

function weekKey(value: string | Date) {
  const date = new Date(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function labelDate(key: string, granularity: Granularity) {
  if (granularity === 'day') {
    return new Date(`${key}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  if (granularity === 'month') {
    return new Date(`${key}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  }
  return key.replace('-', ' ');
}

function getPeriodStart(range: string) {
  const days = range === '30d' ? 30 : range === '180d' ? 180 : range === '365d' ? 365 : 90;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

function groupSales(orders: SalesOrder[], granularity: Granularity) {
  const map: Record<string, any> = {};
  orders.forEach((order) => {
    if (!order.order_date) return;
    const key =
      granularity === 'day' ? dayKey(order.order_date) :
      granularity === 'week' ? weekKey(order.order_date) :
      monthKey(order.order_date);

    if (!map[key]) {
      map[key] = { key, label: labelDate(key, granularity), grossSales: 0, netSales: 0, discounts: 0, orders: 0 };
    }

    map[key].grossSales += asNumber(order.gross_amount);
    map[key].netSales += asNumber(order.net_amount);
    map[key].discounts += asNumber(order.discount_amount);
    map[key].orders += 1;
  });

  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

function groupStockCost(transactions: StockTransaction[], granularity: Granularity) {
  const map: Record<string, any> = {};
  transactions.forEach((tx) => {
    if (!tx.created_at) return;
    const key =
      granularity === 'day' ? dayKey(tx.created_at) :
      granularity === 'week' ? weekKey(tx.created_at) :
      monthKey(tx.created_at);

    if (!map[key]) {
      map[key] = { key, cogsEstimate: 0, wasteValue: 0, stockInValue: 0, stockOutValue: 0, transactionCount: 0 };
    }

    const value = asNumber(tx.quantity) * asNumber(tx.products?.price);
    if (tx.type === 'IN') map[key].stockInValue += value;
    if (tx.type === 'OUT') {
      map[key].stockOutValue += value;
      map[key].cogsEstimate += value;
    }
    if (tx.type === 'WASTE') {
      map[key].wasteValue += value;
      map[key].cogsEstimate += value;
    }
    map[key].transactionCount += 1;
  });
  return map;
}

export type FinanceReport = {
  meta: { range: string; granularity: Granularity; startDate: string; generatedAt: string };
  kpis: Record<string, number>;
  trend: any[];
  byStore: any[];
  stockByCategory: any[];
  topStockValue: any[];
};

export type FinanceReportResult =
  | { ok: true; report: FinanceReport; raw: { orders: SalesOrder[]; products: any[]; transactions: StockTransaction[]; pos: any[] } }
  | { ok: false; error: string };

export async function buildFinanceReport(
  range: string,
  granularity: Granularity
): Promise<FinanceReportResult> {
  const start = getPeriodStart(range);
  const startIso = start.toISOString();

  const [ordersRes, productsRes, transactionsRes, posRes] = await Promise.all([
    fetchAllPages<SalesOrder>(() =>
      supabaseAdmin
        .from('sales_orders')
        .select('app_name, store_name, order_no, order_date, customer_name, gross_amount, net_amount, discount_amount, service_charge_amount, tax_amount, status')
        .gte('order_date', startIso)
        .order('order_date', { ascending: true })
    ),
    fetchAllPages<any>(() =>
      supabaseAdmin
        .from('products')
        .select('id, code, name, category, price, current_stock, min_stock, is_active')
    ),
    fetchAllPages<StockTransaction>(() =>
      supabaseAdmin
        .from('stock_transactions')
        .select('id, type, quantity, created_at, products:product_id(name, price, category)')
        .gte('created_at', startIso)
        .order('created_at', { ascending: true })
    ),
    fetchAllPages<any>(() =>
      supabaseAdmin
        .from('purchase_orders')
        .select('id, status, total_price, created_at, products:product_id(name, category)')
        .gte('created_at', startIso)
        .order('created_at', { ascending: true })
    ),
  ]);

  const firstError = ordersRes.error || productsRes.error || transactionsRes.error || posRes.error;
  if (firstError) return { ok: false, error: firstError.message };

  const orders = (ordersRes.data || []) as SalesOrder[];
  const products = productsRes.data || [];
  const transactions = (transactionsRes.data || []) as StockTransaction[];
  const pos = posRes.data || [];

  const grossSales = orders.reduce((sum, order) => sum + asNumber(order.gross_amount), 0);
  const netSales = orders.reduce((sum, order) => sum + asNumber(order.net_amount), 0);
  const discounts = orders.reduce((sum, order) => sum + asNumber(order.discount_amount), 0);
  const taxAndService = orders.reduce((sum, order) => sum + asNumber(order.tax_amount) + asNumber(order.service_charge_amount), 0);
  const stockAssetValue = products.reduce((sum: number, p: any) => sum + asNumber(p.price) * asNumber(p.current_stock), 0);
  const criticalItems = products.filter((p: any) => asNumber(p.current_stock) <= asNumber(p.min_stock)).length;
  const stockOutValue = transactions
    .filter((tx) => tx.type === 'OUT')
    .reduce((sum, tx) => sum + asNumber(tx.quantity) * asNumber(tx.products?.price), 0);
  const wasteValue = transactions
    .filter((tx) => tx.type === 'WASTE')
    .reduce((sum, tx) => sum + asNumber(tx.quantity) * asNumber(tx.products?.price), 0);
  const cogsEstimate = stockOutValue + wasteValue;
  const grossProfitEstimate = netSales - cogsEstimate;
  const grossMargin = netSales > 0 ? grossProfitEstimate / netSales : 0;
  const approvedPurchaseValue = pos
    .filter((po: any) => po.status === 'APPROVED' || po.status === 'FULFILLED')
    .reduce((sum: number, po: any) => sum + asNumber(po.total_price), 0);

  const salesByPeriod = groupSales(orders, granularity);
  const stockCostByPeriod = groupStockCost(transactions, granularity);
  const trend = salesByPeriod.map((row) => {
    const cost = stockCostByPeriod[row.key] || {};
    const cogs = asNumber(cost.cogsEstimate);
    const profit = row.netSales - cogs;
    return {
      ...row,
      cogsEstimate: cogs,
      wasteValue: asNumber(cost.wasteValue),
      stockOutValue: asNumber(cost.stockOutValue),
      grossProfitEstimate: profit,
      margin: row.netSales > 0 ? profit / row.netSales : 0,
    };
  });

  const byStoreMap: Record<string, any> = {};
  orders.forEach((order) => {
    const store = order.app_name || 'Olsera';
    if (!byStoreMap[store]) byStoreMap[store] = { name: store, grossSales: 0, netSales: 0, orders: 0 };
    byStoreMap[store].grossSales += asNumber(order.gross_amount);
    byStoreMap[store].netSales += asNumber(order.net_amount);
    byStoreMap[store].orders += 1;
  });

  const stockByCategoryMap: Record<string, any> = {};
  products.forEach((product: any) => {
    const category = product.category || 'Lainnya';
    if (!stockByCategoryMap[category]) stockByCategoryMap[category] = { name: category, stockValue: 0, items: 0 };
    stockByCategoryMap[category].stockValue += asNumber(product.price) * asNumber(product.current_stock);
    stockByCategoryMap[category].items += 1;
  });

  const topStockValue = products
    .map((product: any) => ({
      name: product.name,
      category: product.category,
      stock: asNumber(product.current_stock),
      value: asNumber(product.price) * asNumber(product.current_stock),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    ok: true,
    report: {
      meta: { range, granularity, startDate: startIso, generatedAt: new Date().toISOString() },
      kpis: {
        grossSales,
        netSales,
        discounts,
        taxAndService,
        orderCount: orders.length,
        averageOrderValue: orders.length ? netSales / orders.length : 0,
        cogsEstimate,
        stockOutValue,
        wasteValue,
        grossProfitEstimate,
        grossMargin,
        stockAssetValue,
        criticalItems,
        productCount: products.length,
        stockTransactionCount: transactions.length,
        approvedPurchaseValue,
      },
      trend,
      byStore: Object.values(byStoreMap).sort((a: any, b: any) => b.netSales - a.netSales),
      stockByCategory: Object.values(stockByCategoryMap).sort((a: any, b: any) => b.stockValue - a.stockValue),
      topStockValue,
    },
    raw: { orders, products, transactions, pos },
  };
}

export function parseFinanceParams(searchParams: URLSearchParams) {
  const range = searchParams.get('range') || '90d';
  const granularity = (searchParams.get('granularity') || 'day') as Granularity;
  return { range, granularity };
}
