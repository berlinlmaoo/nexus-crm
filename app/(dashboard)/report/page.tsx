"use client";

import { useEffect, useState } from "react";
import { Download, TrendingUp, AlertCircle, ShoppingCart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from "recharts";

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#f97316'];

const formatRp = (val: number) => `Rp ${(val / 1000000).toFixed(1)}jt`;
const formatRpFull = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-bold text-stone-700 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {formatRpFull(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function FinanceReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/report/finance');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Failed to fetch finance report:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleExportExcel = () => {
    // Trigger download from server-side ExcelJS export (supports colors, borders, styling)
    const a = document.createElement('a');
    a.href = '/api/report/export';
    a.download = `NEXUS-Finance-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-500 font-medium">Mengambil data laporan keuangan...</p>
      </div>
    );
  }

  if (!data) return <p className="text-center text-rose-500 py-20">Gagal memuat laporan.</p>;

  const { kpis, assetByCategory, transactionTrend, poTrend, topProducts } = data;

  const kpiCards = [
    { label: 'Total Nilai Aset', value: formatRpFull(kpis.totalAssetValue), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Total Belanja PO', value: formatRpFull(kpis.totalApprovedPOSpend), icon: ShoppingCart, color: 'text-violet-600', bg: 'bg-violet-100' },
    { label: 'Item Kritis', value: String(kpis.criticalItems), sub: 'butuh restock', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-100' },
    { label: 'Total Transaksi', value: String(kpis.totalTransactions), sub: 'semua pergerakan', icon: RefreshCw, color: 'text-sky-600', bg: 'bg-sky-100' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Finance Report</h2>
          <p className="text-stone-500 mt-1">Analisis nilai aset, pengeluaran PO, dan pergerakan stok.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" className="bg-white font-semibold text-stone-700">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={handleExportExcel} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md shadow-amber-500/20">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className={`${kpi.bg} p-2 rounded-lg`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{kpi.label}</p>
            <p className={`text-2xl font-black mt-1 ${kpi.color} leading-tight`}>{kpi.value}</p>
            {kpi.sub && <p className="text-xs text-stone-400 mt-1">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Asset by Category — Pie */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-800 mb-1">Distribusi Aset per Kategori</h3>
          <p className="text-xs text-stone-400 mb-6">Nilai stok berdasarkan kategori produk</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={assetByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {assetByCategory.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val: any) => formatRpFull(Number(val))} />
              <Legend
                formatter={(value) => <span className="text-xs font-bold text-stone-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Trend — Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-800 mb-1">Tren Pergerakan Stok (14 Hari Terakhir)</h3>
          <p className="text-xs text-stone-400 mb-6">Nilai barang masuk, keluar, dan waste dalam Rupiah</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={transactionTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOUT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorWASTE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="IN" name="Masuk" stroke="#10b981" strokeWidth={2} fill="url(#colorIN)" />
              <Area type="monotone" dataKey="OUT" name="Keluar" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOUT)" />
              <Area type="monotone" dataKey="WASTE" name="Waste" stroke="#f43f5e" strokeWidth={2} fill="url(#colorWASTE)" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* PO Spending Trend */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-800 mb-1">Pengeluaran Purchase Order</h3>
          <p className="text-xs text-stone-400 mb-6">Total nilai PO yang disetujui per bulan</p>
          {poTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={poTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(val: any) => formatRpFull(Number(val))} />
                <Bar dataKey="total" name="Total PO" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-stone-400 text-sm">
              Belum ada PO yang disetujui.
            </div>
          )}
        </div>

        {/* Top 10 Products by Value — Table */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-800 mb-1">Top 10 Produk — Nilai Tertinggi</h3>
          <p className="text-xs text-stone-400 mb-4">Berdasarkan harga × stok saat ini</p>
          <div className="space-y-2">
            {topProducts.map((p: any, i: number) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-black text-stone-300 w-5 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-bold text-stone-700 truncate pr-2">{p.name}</p>
                    <p className="text-xs font-black text-amber-600 whitespace-nowrap">
                      {formatRpFull(p.value)}
                    </p>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div
                      className="bg-amber-400 h-1.5 rounded-full"
                      style={{ width: `${(p.value / topProducts[0].value) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
