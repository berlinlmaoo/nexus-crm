import { createClient } from '@supabase/supabase-js';
import { ClipboardList, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function OpnamePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: sessions, error } = await supabase
    .from('opname_sessions')
    .select('id, reference, created_at, notes, petugas_id, total_items, total_discrepancies')
    .order('created_at', { ascending: false });

  if (error) console.error('Opname sessions error:', error);

  // Fetch users separately to avoid FK join issues
  const { data: usersData } = await supabase.from('users').select('id, name');
  const usersMap: Record<string, string> = {};
  (usersData || []).forEach((u: any) => { usersMap[u.id] = u.name; });

  const sessionList = sessions || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Stock Opname</h2>
          <p className="text-stone-500 mt-1">Rekonsiliasi stok fisik vs data sistem untuk menjaga akurasi inventaris.</p>
        </div>
        <Link href="/opname/new">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-500/20">
            <Plus className="h-4 w-4 mr-2" />
            Mulai Opname Baru
          </Button>
        </Link>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
        <ClipboardList className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-bold text-amber-800">Cara Kerja Stock Opname</p>
          <p className="text-amber-700 text-sm mt-1">
            Hitung stok fisik aktual untuk setiap produk, lalu bandingkan dengan data sistem.
            Semua item yang dihitung dicatat, dan selisih disesuaikan secara otomatis.
          </p>
        </div>
      </div>

      {/* Sessions List */}
      {sessionList.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm py-20 text-center">
          <ClipboardList className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-stone-600">Belum Ada Sesi Opname</h3>
          <p className="text-stone-400 text-sm mt-2">Mulai opname pertama untuk memvalidasi stok fisik Anda.</p>
          <Link href="/opname/new">
            <Button className="mt-6 bg-amber-500 hover:bg-amber-600 text-white font-bold">
              <Plus className="h-4 w-4 mr-2" /> Mulai Opname Baru
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessionList.map((session: any) => (
            <div key={session.id} className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-100 p-3 rounded-xl flex-shrink-0">
                    <ClipboardList className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-black text-stone-800 font-mono text-sm">{session.reference}</p>
                    <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(session.created_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                    </p>
                    {session.notes && (
                      <p className="text-xs text-stone-500 mt-1 italic">"{session.notes}"</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-stone-400">Petugas</p>
                    <p className="font-bold text-stone-700 text-sm">{session.petugas_id ? (usersMap[session.petugas_id] || '—') : '—'}</p>
                  </div>
                  <Badge className="bg-stone-100 text-stone-600 border-0 font-bold">
                    {session.total_items} item diperiksa
                  </Badge>
                  {session.total_discrepancies > 0 ? (
                    <Badge className="bg-rose-100 text-rose-700 border-0 font-bold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {session.total_discrepancies} selisih
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Semua sesuai
                    </Badge>
                  )}
                  <Link href={`/opname/${session.id}`}>
                    <Button size="sm" variant="outline" className="font-bold text-amber-600 border-amber-200 hover:bg-amber-50">
                      Lihat Detail
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
