import { createClient } from '@supabase/supabase-js';
import { ClipboardList, ArrowLeft, Clock, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function OpnameDetailPage({ params }: { params: { ref: string } }) {
  const sessionId = params.ref; // now using session UUID

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [sessionRes, itemsRes, usersRes] = await Promise.all([
    supabase
      .from('opname_sessions')
      .select('id, reference, created_at, notes, petugas_id, total_items, total_discrepancies')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('opname_items')
      .select('*, products:product_id(name, code, category, unit, price)')
      .eq('session_id', sessionId)
      .order('selisih'),
    supabase.from('users').select('id, name'),
  ]);

  const session = sessionRes.data;
  const items = itemsRes.data || [];
  const usersMap: Record<string, string> = {};
  (usersRes.data || []).forEach((u: any) => { usersMap[u.id] = u.name; });
  const petugasName = session?.petugas_id ? (usersMap[session.petugas_id] || '—') : '—';

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">Sesi opname tidak ditemukan.</p>
        <Link href="/opname"><Button className="mt-4">Kembali</Button></Link>
      </div>
    );
  }

  const itemSesuai = items.filter(i => i.selisih === 0).length;
  const itemKurang = items.filter(i => i.selisih < 0).length;
  const itemLebih  = items.filter(i => i.selisih > 0).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/opname">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Detail Sesi Opname</h2>
          <p className="text-sm font-mono font-bold text-stone-400 mt-0.5">{session.reference}</p>
        </div>
      </div>

      {/* Meta Card */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6">
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Petugas</p>
            <p className="font-bold text-stone-800 mt-1 text-lg">{petugasName}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3" /> Waktu Pelaksanaan
            </p>
            <p className="font-bold text-stone-800 mt-1">
              {new Date(session.created_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Catatan</p>
            <p className="font-medium text-stone-600 mt-1 text-sm italic">{session.notes || '—'}</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Diperiksa</p>
          <p className="text-4xl font-black text-stone-800 mt-1">{session.total_items}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">✅ Sesuai</p>
          <p className="text-4xl font-black text-emerald-700 mt-1">{itemSesuai}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">⚠ Kurang</p>
          <p className="text-4xl font-black text-rose-700 mt-1">{itemKurang}</p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">↑ Lebih</p>
          <p className="text-4xl font-black text-sky-700 mt-1">{itemLebih}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-500" />
          <h3 className="font-bold text-stone-800">Rincian Semua Item yang Diperiksa</h3>
          <Badge className="ml-auto bg-amber-100 text-amber-700 border-0">{items.length} item</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Produk</th>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Kategori</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Stok Sistem</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Hitung Fisik</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Selisih</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {items.map((item: any) => {
                const isMatch  = item.selisih === 0;
                const isShort  = item.selisih < 0;
                const isExcess = item.selisih > 0;

                return (
                  <tr key={item.id} className={`transition-colors ${isMatch ? 'hover:bg-stone-50/50' : isShort ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'bg-sky-50/30 hover:bg-sky-50/50'}`}>
                    <td className="py-3 px-4">
                      <p className="font-bold text-stone-800">{item.products?.name || '—'}</p>
                      <p className="text-xs text-stone-400 font-mono">{item.products?.code}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs bg-stone-50 text-stone-600 border-stone-200">
                        {item.products?.category || '—'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-stone-500">{item.system_stock}</span>
                      <span className="text-xs text-stone-400 ml-1">{item.products?.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-stone-900 text-base">{item.physical_count}</span>
                      <span className="text-xs text-stone-400 ml-1">{item.products?.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isExcess && <TrendingUp className="h-4 w-4 text-sky-500" />}
                        {isShort  && <TrendingDown className="h-4 w-4 text-rose-500" />}
                        {isMatch  && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        <span className={`font-black text-lg ${isMatch ? 'text-emerald-400' : isShort ? 'text-rose-600' : 'text-sky-600'}`}>
                          {isExcess ? '+' : ''}{item.selisih}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isMatch
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">✅ Sesuai</Badge>
                        : isShort
                        ? <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">⚠ Kurang</Badge>
                        : <Badge className="bg-sky-100 text-sky-700 border-0 text-xs">↑ Lebih</Badge>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="py-16 text-center text-stone-400 text-sm">Data item tidak ditemukan.</div>
          )}
        </div>
      </div>
    </div>
  );
}
