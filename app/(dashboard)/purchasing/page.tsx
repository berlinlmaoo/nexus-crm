import { createClient } from '@/lib/supabase/server';
import { ShoppingCart, Plus, Filter, CheckCircle2, XCircle, Clock, Truck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_MANAGER: { label: 'Menunggu Manager', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  PENDING_OWNER:   { label: 'Menunggu Owner',   color: 'bg-sky-50 text-sky-700 border-sky-200', icon: Clock },
  APPROVED:        { label: 'Disetujui',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  REJECTED:        { label: 'Ditolak',           color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
  FULFILLED:       { label: 'Terpenuhi',         color: 'bg-stone-100 text-stone-600 border-stone-200', icon: Truck },
};

export default async function PurchasingPage() {
  const supabase = createClient();


  const { data: pos, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      products:product_id (name, unit),
      requester:requester_id (name),
      items:purchase_order_items (id, quantity, products:product_id (name, unit))
    `)
    .order('created_at', { ascending: false });

  if (error) console.error(error);

  const pending = pos?.filter(p => p.status === 'PENDING_MANAGER' || p.status === 'PENDING_OWNER').length || 0;
  const approved = pos?.filter(p => p.status === 'APPROVED').length || 0;
  // PO baru nilainya di `total_amount` (jumlah semua barisnya); `total_price` cuma ada di PO
  // gaya lama yang satu barang.
  const totalSpend = pos?.filter(p => p.status === 'APPROVED' || p.status === 'FULFILLED')
    .reduce((sum, p) => sum + (p.total_amount ?? p.total_price ?? 0), 0) || 0;

  // Ringkasan isi PO: satu baris = satu barang. PO borongan dari beberapa request punya banyak
  // baris, jadi "nama barang" doang nggak cukup lagi buat ngewakilin isinya.
  const ringkas = (po: any) => {
    const items = po.items || [];
    if (items.length === 0) return { judul: po.products?.name || '—', detail: po.quantity ? `${po.quantity} ${po.products?.unit ?? ''}` : '—' };
    if (items.length === 1) return { judul: items[0].products?.name || '—', detail: `${items[0].quantity} ${items[0].products?.unit ?? ''}` };
    const total = items.reduce((n: number, i: any) => n + i.quantity, 0);
    return { judul: `${items.length} barang`, detail: `${total} unit total` };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Purchase Orders</h2>
          <p className="text-stone-500 mt-1">PO lahir dari Purchase Request yang diborong, terus nunggu persetujuan Owner.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-stone-700 bg-white shadow-sm font-semibold">
            <Filter className="h-4 w-4 mr-2 text-stone-400" />
            Filter
          </Button>
          <Link href="/purchase-requests">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md shadow-amber-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Papan Purchase Request
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Pending Approval</h3>
          <span className="text-3xl font-black text-amber-600 block mt-2">{pending} <span className="text-sm font-bold text-amber-600/60">PO</span></span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Disetujui</h3>
          <span className="text-3xl font-black text-emerald-600 block mt-2">{approved} <span className="text-sm font-bold text-emerald-600/60">PO</span></span>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Total Belanja Disetujui</h3>
          <span className="text-2xl font-black text-stone-800 block mt-2">Rp {totalSpend.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-stone-600">No. PO</TableHead>
                <TableHead className="font-bold text-stone-600">Produk</TableHead>
                <TableHead className="text-right font-bold text-stone-600">Qty</TableHead>
                <TableHead className="text-right font-bold text-stone-600">Total Harga</TableHead>
                <TableHead className="font-bold text-stone-600">Pemohon</TableHead>
                <TableHead className="font-bold text-stone-600">Tanggal</TableHead>
                <TableHead className="text-center font-bold text-stone-600">Status</TableHead>
                <TableHead className="text-center font-bold text-stone-600">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos?.map((po: any) => {
                const cfg = statusConfig[po.status] || statusConfig['PENDING_MANAGER'];
                const StatusIcon = cfg.icon;
                return (
                  <TableRow key={po.id} className="hover:bg-stone-50/50 transition-colors">
                    <TableCell className="font-mono font-bold text-stone-500 text-xs">{po.po_number}</TableCell>
                    <TableCell className="font-bold text-stone-800">{ringkas(po).judul}</TableCell>
                    <TableCell className="text-right font-bold">
                      <span className="text-sm">{ringkas(po).detail}</span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-stone-700">
                      {(po.total_amount ?? po.total_price)
                        ? `Rp ${(po.total_amount ?? po.total_price).toLocaleString('id-ID')}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-stone-600">{po.requester?.name || '—'}</TableCell>
                    <TableCell className="text-stone-500 text-sm">
                      {new Date(po.created_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`${cfg.color} text-xs gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link 
                        href={`/purchasing/${po.id}`}
                        className="inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-9 px-3 text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold text-xs"
                      >
                        Detail
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {(!pos || pos.length === 0) && (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <ShoppingCart className="h-10 w-10 text-stone-300" />
              <p className="text-stone-500 font-medium">Belum ada Purchase Order. Buat PO pertama Anda!</p>
              <Link href="/purchase-requests">
                <Button size="sm" className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold">
                  <Plus className="h-4 w-4 mr-1" /> Papan Purchase Request
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
