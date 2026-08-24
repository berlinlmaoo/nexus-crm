"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Download,
  RefreshCw,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#f43f5e", "#06b6d4", "#84cc16", "#f97316"];

const ranges = [
  { label: "30 Hari", value: "30d" },
  { label: "90 Hari", value: "90d" },
  { label: "180 Hari", value: "180d" },
  { label: "1 Tahun", value: "365d" },
];

const granularities = [
  { label: "Harian", value: "day" },
  { label: "Mingguan", value: "week" },
  { label: "Bulanan", value: "month" },
];

const formatRp = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
const formatShortRp = (value: number) => {
  const n = Math.abs(value || 0);
  if (n >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`;
  return `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
};
const formatPercent = (value: number) => `${((value || 0) * 100).toFixed(1)}%`;

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-bold text-stone-700">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} className="font-semibold" style={{ color: item.color }}>
          {item.name}: {item.dataKey === "orders" ? item.value : formatRp(Number(item.value))}
        </p>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, tone }: any) {
  const tones: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
    stone: "bg-stone-100 text-stone-700",
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-md p-2 ${tones[tone] || tones.stone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-black leading-tight text-stone-900">{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-stone-500">{sub}</p>}
    </div>
  );
}

export default function FinanceReportPage() {
  const [range, setRange] = useState("90d");
  const [granularity, setGranularity] = useState("day");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/report/finance?range=${range}&granularity=${granularity}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range, granularity]);

  const kpis = data?.kpis;
  const latestTrend = useMemo(() => data?.trend?.slice(-18) || [], [data]);

  const handleExportExcel = () => {
    const a = document.createElement("a");
    a.href = `/api/report/export?range=${range}&granularity=${granularity}`;
    a.download = `NEXUS-Finance-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  if (loading && !data) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="font-medium text-stone-500">Mengambil data finance restoran...</p>
      </div>
    );
  }

  if (!data?.kpis) {
    return <p className="py-20 text-center text-rose-500">Gagal memuat dashboard finance.</p>;
  }

  const kpiCards = [
    {
      label: "Gross Sales",
      value: formatRp(kpis.grossSales),
      sub: "Dari order_amount Olsera",
      icon: TrendingUp,
      tone: "emerald",
    },
    {
      label: "Net Collected",
      value: formatRp(kpis.netSales),
      sub: `${kpis.orderCount.toLocaleString("id-ID")} order selesai`,
      icon: Wallet,
      tone: "sky",
    },
    {
      label: "Gross Profit Est.",
      value: formatRp(kpis.grossProfitEstimate),
      sub: `Margin ${formatPercent(kpis.grossMargin)}`,
      icon: TrendingUp,
      tone: "amber",
    },
    {
      label: "COGS Nexus",
      value: formatRp(kpis.cogsEstimate),
      sub: "Stock OUT + WASTE dari Nexus",
      icon: TrendingDown,
      tone: "rose",
    },
    {
      label: "Nilai Stok",
      value: formatRp(kpis.stockAssetValue),
      sub: `${kpis.productCount.toLocaleString("id-ID")} produk Nexus`,
      icon: Boxes,
      tone: "violet",
    },
    {
      label: "Waste Value",
      value: formatRp(kpis.wasteValue),
      sub: "Kerugian stok tercatat",
      icon: AlertTriangle,
      tone: "rose",
    },
    {
      label: "AOV",
      value: formatRp(kpis.averageOrderValue),
      sub: "Rata-rata net per order",
      icon: CalendarDays,
      tone: "stone",
    },
    {
      label: "Stok Kritis",
      value: kpis.criticalItems.toLocaleString("id-ID"),
      sub: "Item <= minimum stock",
      icon: AlertTriangle,
      tone: "amber",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Finance Dashboard</h2>
          <p className="mt-1 text-sm text-stone-500">
            Revenue dari Olsera, stok dan COGS dari Nexus CRM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-stone-200 bg-white p-1">
            {ranges.map((item) => (
              <button
                key={item.value}
                onClick={() => setRange(item.value)}
                className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                  range === item.value ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-stone-200 bg-white p-1">
            {granularities.map((item) => (
              <button
                key={item.value}
                onClick={() => setGranularity(item.value)}
                className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                  granularity === item.value ? "bg-amber-500 text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button onClick={fetchData} variant="outline" className="bg-white font-semibold text-stone-700">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleExportExcel} className="bg-amber-500 font-semibold text-white hover:bg-amber-600">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5">
            <h3 className="font-bold text-stone-900">Revenue vs COGS Nexus</h3>
            <p className="mt-1 text-xs text-stone-500">
              Net collected dari Olsera dibanding estimasi COGS dari transaksi stok Nexus.
            </p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={latestTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} />
              <YAxis tickFormatter={formatShortRp} tick={{ fontSize: 11, fill: "#78716c" }} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Bar dataKey="netSales" name="Net Collected" fill="#10b981" radius={[5, 5, 0, 0]} />
              <Bar dataKey="cogsEstimate" name="COGS Nexus" fill="#f43f5e" radius={[5, 5, 0, 0]} />
              <Line type="monotone" dataKey="grossProfitEstimate" name="Gross Profit Est." stroke="#f59e0b" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <h3 className="font-bold text-stone-900">Revenue per Outlet</h3>
            <p className="mt-1 text-xs text-stone-500">Berdasarkan app/store Olsera.</p>
          </div>
          <div className="space-y-4">
            {data.byStore.map((store: any) => {
              const max = Math.max(...data.byStore.map((row: any) => row.netSales), 1);
              return (
                <div key={store.name}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Store className="h-4 w-4 shrink-0 text-amber-500" />
                      <p className="truncate text-sm font-bold text-stone-800">{store.name}</p>
                    </div>
                    <p className="text-xs font-black text-stone-900">{formatRp(store.netSales)}</p>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100">
                    <div
                      className="h-2 rounded-full bg-amber-500"
                      style={{ width: `${Math.max(4, (store.netSales / max) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-stone-400">{store.orders.toLocaleString("id-ID")} order</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-stone-900">Gross vs Net Sales</h3>
            <p className="mt-1 text-xs text-stone-500">Periode mengikuti filter di atas.</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={latestTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grossFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} />
              <YAxis tickFormatter={formatShortRp} tick={{ fontSize: 11, fill: "#78716c" }} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="grossSales" name="Gross Sales" stroke="#3b82f6" fill="url(#grossFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="netSales" name="Net Collected" stroke="#10b981" fill="url(#netFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-stone-900">Nilai Stok per Kategori</h3>
            <p className="mt-1 text-xs text-stone-500">Berdasarkan stok aktif di Nexus CRM.</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data.stockByCategory} dataKey="stockValue" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
                {data.stockByCategory.map((_: any, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatRp(Number(value))} />
              <Legend formatter={(value) => <span className="text-xs font-bold text-stone-600">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="font-bold text-stone-900">Top Produk Berdasarkan Nilai Stok</h3>
          <p className="mt-1 text-xs text-stone-500">Harga x current stock dari Nexus CRM.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="py-3 pr-3 font-bold">Produk</th>
                <th className="py-3 pr-3 font-bold">Kategori</th>
                <th className="py-3 pr-3 text-right font-bold">Stok</th>
                <th className="py-3 text-right font-bold">Nilai Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {data.topStockValue.map((product: any) => (
                <tr key={`${product.name}-${product.category}`}>
                  <td className="py-3 pr-3 font-bold text-stone-800">{product.name}</td>
                  <td className="py-3 pr-3 text-stone-500">{product.category || "Lainnya"}</td>
                  <td className="py-3 pr-3 text-right font-semibold text-stone-700">{product.stock.toLocaleString("id-ID")}</td>
                  <td className="py-3 text-right font-black text-amber-600">{formatRp(product.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
