import { createClient } from '@/lib/supabase/server';
import { Camera, MapPin, UserCheck, SlidersHorizontal, Share, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { startOfDay, endOfDay, format } from 'date-fns';
import { id } from 'date-fns/locale';
import AttendanceFilter from '@/components/attendance/AttendanceFilter';
import DashboardSearch from '@/components/ui/dashboard-search';
import AttendanceModal from '@/components/attendance/AttendanceModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function AttendanceLogPage(props: { searchParams?: Promise<{ q?: string; filter?: string }> }) {
  const searchParams = await props.searchParams;
  const query = searchParams?.q || "";
  const filterVal = searchParams?.filter || "ALL";

  const supabase = createClient();
  
  // 1. Fetch Users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name, email, role, photo_url, phone')
    .eq('is_active', true)
    .order('name');
    
  // 2. Fetch Today's Attendance
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();

  const { data: logs, error: logError } = await supabase
    .from('attendance')
    .select('*')
    .gte('timestamp', todayStart)
    .lte('timestamp', todayEnd)
    .order('timestamp', { ascending: false });

  // 3. Zip Data
  const logsByUser = new Map();
  if (logs) {
    // Since ordered descending, the first one encountered is the latest check-in/out for the user
    for (const log of logs) {
      if (!logsByUser.has(log.user_id)) {
        logsByUser.set(log.user_id, log);
      }
    }
  }

  let finalUsers = (users || []).map(u => {
    const log = logsByUser.get(u.id);
    return {
      ...u,
      log
    };
  });

  // Simple Filtering
  if (query) {
    finalUsers = finalUsers.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
  }

  // Calculate Metrics from unfiltered base
  const totalStaff = users?.length || 0;
  const metrics = {
    hadir: 0,
    telat: 0,
    belum: 0,
    luar: 0
  };

  (users || []).forEach(u => {
    const log = logsByUser.get(u.id);
    if (!log) {
      metrics.belum++;
    } else {
      metrics.hadir++;
      if (log.status === 'LATE') metrics.telat++;
      if (log.status === 'OUT_OF_RANGE') metrics.luar++;
    }
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-stone-900">Absensi Hari Ini</h2>
          <p className="text-stone-500 mt-2 flex items-center font-medium gap-2">
            {format(new Date(), "d MMMM yyyy", { locale: id })}
            <span className="text-stone-300">•</span>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-sm">
              {metrics.hadir} dari {totalStaff} staff sudah check-in
            </span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
             <DashboardSearch defaultQuery={query} placeholder="Cari staff..." />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button variant="outline" className="bg-stone-100/50 border-stone-200 text-stone-700 font-bold hover:bg-stone-200 flex-1 sm:flex-none">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-stone-500" />
              Filter
            </Button>
            <Button className="bg-[#b47a22] hover:bg-[#966319] text-white font-bold shadow-md shadow-amber-900/10 flex-1 sm:flex-none tracking-wide">
              <Share className="h-4 w-4 mr-2" />
              Export Log
            </Button>
          </div>
        </div>
      </div>

      {/* Ringkasan absensi hari ini.
          Ditulis ulang 2026-08-20. Yang lama pakai garis warna tebal di sisi kiri kartu
          (`border-l-4`) — pola yang bikin tiap kartu keliatan kayak potongan template, bukan
          sesuatu yang dirancang. Diganti: latar bernada warna cuma waktu ada yang perlu
          ditindak, dan netral waktu semuanya beres.

          Perbaikan yang lebih penting daripada tampilan: DULU EMPAT ANGKA NOL BERTERIAK SAMA
          KERASNYA. Padahal "0 telat" itu kabar baik dan "6 belum check-in" itu kerjaan. Sekarang
          angka yang nggak butuh tindakan sengaja diredam abu-abu, dan yang butuh tindakan yang
          diwarnain — jadi mata langsung jatuh ke tempat yang bener. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const persen = totalStaff > 0 ? Math.round((metrics.hadir / totalStaff) * 100) : 0;

          const kartu = [
            {
              label: "Hadir",
              nilai: metrics.hadir,
              dari: totalStaff,
              nada: metrics.hadir > 0 ? "baik" : "netral",
              catatan: `${persen}% dari ${totalStaff} staff`,
            },
            {
              label: "Telat",
              nilai: metrics.telat,
              nada: metrics.telat > 0 ? "perhatian" : "netral",
              catatan: metrics.telat > 0 ? "perlu ditindaklanjuti" : "nggak ada yang telat",
            },
            {
              label: "Belum Check-In",
              nilai: metrics.belum,
              dari: totalStaff,
              nada: metrics.belum > 0 ? "perhatian" : "baik",
              catatan: metrics.belum > 0 ? "belum absen hari ini" : "semua udah absen",
            },
            {
              label: "Luar Radius",
              nilai: metrics.luar,
              nada: metrics.luar > 0 ? "bahaya" : "netral",
              catatan: metrics.luar > 0 ? "absen di luar area kantor" : "semua di dalam area",
            },
          ] as const;

          const gaya: Record<string, { kartu: string; angka: string; pembagi: string; catatan: string; titik: string }> = {
            // Nada netral dipakai buat nol yang justru kabar baik. Angkanya diredam biar nggak
            // ikut berteriak — TAPI cuma sampai stone-500, bukan lebih pucat. Angka ini isi
            // utama kartunya; kalau dibikin stone-300 dia lolos jadi hiasan dan orang harus
            // mendekat ke layar buat baca angkanya sendiri.
            netral:    { kartu: "border-stone-200 bg-white",           angka: "text-stone-500",   pembagi: "text-stone-500",   catatan: "text-stone-500",   titik: "bg-stone-300" },
            baik:      { kartu: "border-emerald-200 bg-emerald-50/50", angka: "text-emerald-700", pembagi: "text-emerald-700", catatan: "text-emerald-800", titik: "bg-emerald-500" },
            perhatian: { kartu: "border-amber-200 bg-amber-50/60",     angka: "text-amber-700",   pembagi: "text-amber-700",   catatan: "text-amber-800",   titik: "bg-amber-500" },
            bahaya:    { kartu: "border-rose-200 bg-rose-50/60",       angka: "text-rose-700",    pembagi: "text-rose-700",    catatan: "text-rose-800",    titik: "bg-rose-500" },
          };

          return kartu.map((k) => {
            const g = gaya[k.nada];
            return (
              <div key={k.label} className={`rounded-2xl border p-5 shadow-sm ${g.kartu}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${g.titik}`} />
                  {/* stone-600, bukan stone-400: label yang kepucetan bikin orang harus
                      mendekat ke layar buat tahu angka ini angka apa. */}
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-600">
                    {k.label}
                  </h3>
                </div>

                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-4xl font-black leading-none tracking-tight ${g.angka}`}>
                    {k.nilai}
                  </span>
                  {"dari" in k && k.dari ? (
                    // Warnanya ngikutin rona kartunya. Abu-abu di atas latar kuning/merah
                    // kebaca pudar, dan pembagi yang pudar bikin "6 / 6" keliatan kayak "6".
                    <span className={`text-lg font-bold opacity-70 ${g.pembagi}`}>/ {k.dari}</span>
                  ) : null}
                </p>

                {/* Tiap kartu punya SATU baris keterangan dengan bentuk yang sama. Yang lama
                    beda-beda — ada yang persen, ada yang lencana, ada yang kosong — jadi
                    keempatnya keliatan sekelompok tapi kelakuannya nggak. */}
                <p className={`mt-2 text-xs font-medium ${g.catatan}`}>{k.catatan}</p>
              </div>
            );
          });
        })()}
      </div>

      {/* Daftar staff — list view. Satu baris per orang, jadi 6+ staff kebaca sekali lihat
          tanpa scroll panjang kayak versi kartu. */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden mt-8">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-stone-600">Staff</TableHead>
                <TableHead className="font-bold text-stone-600">Status</TableHead>
                <TableHead className="font-bold text-stone-600">Check-In</TableHead>
                <TableHead className="font-bold text-stone-600">Lokasi</TableHead>
                <TableHead className="text-right font-bold text-stone-600">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalUsers.map(u => {
                const isWaiting = !u.log;
                const isLate = u.log?.status === 'LATE';
                const isOutRange = u.log?.status === 'OUT_OF_RANGE';

                let badgeVariant = "bg-stone-200 text-stone-600";
                let badgeText = "MENUNGGU";

                if (!isWaiting) {
                  if (isLate) {
                    badgeVariant = "bg-rose-100 text-rose-700 uppercase tracking-wider text-[10px] shadow-none";
                    badgeText = "TELAT CHECKIN";
                  } else if (isOutRange) {
                    badgeVariant = "bg-amber-100 text-amber-700 uppercase tracking-wider text-[10px] shadow-none";
                    badgeText = "LUAR RADIUS";
                  } else {
                    badgeVariant = "bg-[#6be4b6] text-emerald-900 uppercase tracking-wider text-[10px] shadow-none font-bold border-none";
                    badgeText = "TEPAT WAKTU";
                  }
                }

                return (
                  <TableRow key={u.id} className={`hover:bg-stone-50/50 transition-colors ${isWaiting ? "opacity-70" : ""}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="h-10 w-10 border border-stone-200">
                            <AvatarImage src={u.photo_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-stone-200 text-stone-500 font-bold">{u.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
                            ${isWaiting ? 'bg-stone-300' : isLate ? 'bg-amber-500' : 'bg-emerald-600'}`}></div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-stone-900 leading-tight truncate">{u.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{u.role}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell><Badge className={badgeVariant}>{badgeText}</Badge></TableCell>

                    <TableCell>
                      {isWaiting ? (
                        <span className="text-sm italic text-stone-400">Belum check-in</span>
                      ) : (
                        <span className="font-bold text-stone-900 tabular-nums">
                          {new Date(u.log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {isWaiting ? (
                        <span className="text-stone-300">&mdash;</span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                          <MapPin className={`h-3.5 w-3.5 ${isOutRange ? 'text-amber-600' : 'text-emerald-600'}`} />
                          {isOutRange ? 'Luar radius' : 'Dalam radius'}
                          {u.log.distance_from_office != null && (
                            <span className="text-stone-400">({Math.round(u.log.distance_from_office)}m)</span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {!isWaiting ? (
                        <AttendanceModal user={u} log={u.log} />
                      ) : u.phone ? (
                        <a href={`https://wa.me/${u.phone.replace(/[^0-9]/g, '')}?text=Halo%20${encodeURIComponent(u.name)},%20jangan%20lupa%20untuk%20melakukan%20Check-In%20presensi%20hari%20ini%20ya!`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" className="font-bold text-sm text-stone-700 bg-stone-200/50 hover:bg-stone-200">
                            Ingatkan via WA
                          </Button>
                        </a>
                      ) : (
                        <Button variant="ghost" disabled className="font-bold text-sm text-stone-400 bg-stone-100">
                          Ingatkan Staff
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {finalUsers.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center">
              <UserCheck className="h-10 w-10 text-stone-300 mb-3" />
              <p className="text-stone-500 font-medium tracking-wide">Data staff kosong atau filter tidak ditepat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
