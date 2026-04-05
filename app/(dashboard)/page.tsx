import { createClient } from '@/lib/supabase/server';
import { 
  Package, AlertCircle, UserCheck, ShoppingCart,
  TrendingUp, TrendingDown, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function DashboardHome() {
  const supabase = createClient();

  // Fetch all data in parallel
  const [productsRes, attendanceRes, transactionsRes, poRes] = await Promise.all([
    supabase.from('products').select('id, name, current_stock, min_stock, price, category'),
    supabase.from('attendance').select('id, check_type, status, timestamp, users:user_id(name)').order('timestamp', { ascending: false }).limit(5),
    supabase.from('stock_transactions').select('id, type, quantity, created_at, products:product_id(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('purchase_orders').select('id, po_number, status, total_price, created_at, products:product_id(name)').order('created_at', { ascending: false }).limit(5),
  ]);

  const products = productsRes.data || [];
  const attendance = attendanceRes.data || [];
  const transactions = transactionsRes.data || [];
  const pos = poRes.data || [];

  // Calculate KPIs
  const totalAssetValue = products.reduce((sum, p) => sum + (p.price * p.current_stock), 0);
  const criticalItems = products.filter(p => p.current_stock <= p.min_stock);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(a => a.timestamp?.startsWith(todayStr) && a.check_type === 'IN');
  const pendingPOs = pos.filter(p => p.status === 'PENDING_MANAGER' || p.status === 'PENDING_OWNER');

  const kpis = [
    { 
      title: 'Nilai Aset Stok', 
      value: `Rp ${(totalAssetValue / 1000000).toFixed(1)}jt`, 
      sub: `${products.length} jenis barang`,
      icon: TrendingUp, 
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      href: '/stock'
    },
    { 
      title: 'Stok Kritis', 
      value: String(criticalItems.length), 
      sub: 'butuh restock segera',
      icon: AlertCircle, 
      color: 'text-rose-600',
      bg: 'bg-rose-100',
      href: '/stock'
    },
    { 
      title: 'Absensi Hari Ini', 
      value: String(todayAttendance.length),
      sub: 'staf hadir hari ini',
      icon: UserCheck, 
      color: 'text-sky-600',
      bg: 'bg-sky-100',
      href: '/attendance'
    },
    { 
      title: 'PO Menunggu', 
      value: String(pendingPOs.length),
      sub: 'perlu persetujuan',
      icon: ShoppingCart, 
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      href: '/purchasing'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard Utama</h2>
          <p className="text-stone-500 mt-1">Ringkasan performa inventaris & operasional NEXUS CRM</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock/scan">
            <Button className="font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
              + Scan Barang
            </Button>
          </Link>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link href={kpi.href} key={kpi.title}>
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all duration-200 cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className={`${kpi.bg} p-2 rounded-lg`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{kpi.title}</p>
                <p className={`text-3xl font-black mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-stone-500 font-medium mt-1">{kpi.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Two-column activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Critical Stock Alert */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              Stok Kritis
            </h3>
            <Link href="/stock" className="text-xs font-bold text-amber-600 hover:underline">Lihat Semua</Link>
          </div>
          <div className="divide-y divide-stone-50">
            {criticalItems.slice(0, 5).map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                <div>
                  <p className="font-bold text-stone-800 text-sm">{item.name}</p>
                  <p className="text-xs text-stone-400">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-rose-600">{item.current_stock}</p>
                  <p className="text-[10px] text-stone-400">min: {item.min_stock}</p>
                </div>
              </div>
            ))}
            {criticalItems.length === 0 && (
              <div className="px-5 py-8 text-center text-stone-400 text-sm">
                ✅ Semua stok dalam kondisi aman!
              </div>
            )}
          </div>
        </div>

        {/* Recent Attendance */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-sky-500" />
              Absensi Terakhir
            </h3>
            <Link href="/attendance" className="text-xs font-bold text-amber-600 hover:underline">Lihat Semua</Link>
          </div>
          <div className="divide-y divide-stone-50">
            {attendance.map((log: any) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                <div>
                  <p className="font-bold text-stone-800 text-sm">{log.users?.name || 'Unknown'}</p>
                  <p className="text-xs text-stone-400">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={log.check_type === 'IN' ? 'text-sky-600 border-sky-200 bg-sky-50' : 'text-stone-500 border-stone-200'}>
                    {log.check_type}
                  </Badge>
                  <Badge variant="outline" className={
                    log.status === 'ONTIME' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
                    log.status === 'LATE' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                    'text-rose-600 border-rose-200 bg-rose-50'
                  }>
                    {log.status}
                  </Badge>
                </div>
              </div>
            ))}
            {attendance.length === 0 && (
              <div className="px-5 py-8 text-center text-stone-400 text-sm">Belum ada absensi hari ini.</div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              Transaksi Stok Terakhir
            </h3>
            <Link href="/stock" className="text-xs font-bold text-amber-600 hover:underline">Lihat Semua</Link>
          </div>
          <div className="divide-y divide-stone-50">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                <div>
                  <p className="font-bold text-stone-800 text-sm">{tx.products?.name || 'Unknown'}</p>
                  <p className="text-xs text-stone-400">{new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    tx.type === 'IN' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                    tx.type === 'OUT' ? 'text-sky-700 border-sky-200 bg-sky-50' :
                    tx.type === 'WASTE' ? 'text-rose-700 border-rose-200 bg-rose-50' :
                    'text-amber-700 border-amber-200 bg-amber-50'
                  }>
                    {tx.type}
                  </Badge>
                  <span className="font-black text-stone-800 text-sm">×{tx.quantity}</span>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="px-5 py-8 text-center text-stone-400 text-sm">Belum ada transaksi stok.</div>
            )}
          </div>
        </div>

        {/* Recent Purchase Orders */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-violet-500" />
              Purchase Orders Terbaru
            </h3>
            <Link href="/purchasing" className="text-xs font-bold text-amber-600 hover:underline">Lihat Semua</Link>
          </div>
          <div className="divide-y divide-stone-50">
            {pos.map((po: any) => (
              <div key={po.id} className="px-5 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                <div>
                  <p className="font-bold text-stone-800 text-sm">{po.products?.name || 'Unknown'}</p>
                  <p className="text-xs text-stone-400 font-mono">{po.po_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    po.status === 'APPROVED' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                    po.status === 'REJECTED' ? 'text-rose-700 border-rose-200 bg-rose-50' :
                    po.status === 'FULFILLED' ? 'text-sky-700 border-sky-200 bg-sky-50' :
                    'text-amber-700 border-amber-200 bg-amber-50'
                  }>
                    {po.status?.replace('_', ' ') || 'PENDING'}
                  </Badge>
                  {po.total_price && (
                    <span className="text-xs font-bold text-stone-600">Rp {po.total_price.toLocaleString('id-ID')}</span>
                  )}
                </div>
              </div>
            ))}
            {pos.length === 0 && (
              <div className="px-5 py-8 text-center text-stone-400 text-sm">Belum ada purchase order.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
