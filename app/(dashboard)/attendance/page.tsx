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

      {/* 4 Pillar Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-l-emerald-500 border border-stone-100 flex flex-col justify-between h-32 relative overflow-hidden">
          <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest relative z-10">Hadir</h3>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl font-black tracking-tighter text-stone-900 leading-none">{metrics.hadir}</span>
            <span className="text-emerald-500 font-bold text-sm mb-1">{totalStaff > 0 ? Math.round((metrics.hadir/totalStaff)*100) : 0}%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-l-amber-500 border border-stone-100 flex flex-col justify-between h-32 relative overflow-hidden">
          <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest relative z-10">Telat</h3>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl font-black tracking-tighter text-stone-900 leading-none">{metrics.telat}</span>
            {metrics.telat === 0 ? (
               <span className="text-emerald-600 font-bold text-xs mb-1 bg-emerald-50 px-2 py-0.5 rounded-md">Aman</span>
            ) : (
               <span className="text-amber-600 font-bold text-xs mb-1 bg-amber-50 px-2 py-0.5 rounded-md">Warning</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-l-sky-400 border border-stone-100 flex flex-col justify-between h-32 relative overflow-hidden">
          <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest relative z-10">Belum Check-In</h3>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl font-black tracking-tighter text-stone-900 leading-none">{metrics.belum}</span>
          </div>
        </div>

        <div className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 border border-stone-100 flex flex-col justify-between h-32 relative overflow-hidden ${metrics.luar === 0 ? "border-l-emerald-500" : "border-l-rose-500"}`}>
          <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest relative z-10">Luar Radius</h3>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl font-black tracking-tighter text-stone-900 leading-none">{metrics.luar}</span>
            {metrics.luar === 0 ? (
               <span className="text-emerald-600 font-bold text-xs mb-1 bg-emerald-50 px-2 py-0.5 rounded-md">Aman</span>
            ) : (
               <span className="text-rose-600 font-bold text-xs mb-1 bg-rose-50 px-2 py-0.5 rounded-md">Pelanggaran</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
        {finalUsers.map(u => {
          const isWaiting = !u.log;
          const isLate = u.log?.status === 'LATE';
          const isOutRange = u.log?.status === 'OUT_OF_RANGE';
          
          let cardClasses = "rounded-3xl border border-stone-100 p-6 flex flex-col gap-6 shadow-[0px_4px_20px_-10px_rgba(0,0,0,0.05)] transition-all";
          if (isWaiting) {
            cardClasses += " bg-stone-50/50 grayscale-[20%] opacity-80 border-dashed border-stone-200";
          } else {
            cardClasses += " bg-stone-50/20";
          }

          let badgeVariant = "bg-stone-200 text-stone-600";
          let badgeText = "MENUNGGU";
          
          if (!isWaiting) {
            if (isLate) {
              badgeVariant = "bg-rose-100 text-rose-700 uppercase tracking-wider text-[10px] shadow-none";
              badgeText = "TELAT CHECKIN"; // TBD calculate duration
            } else if (isOutRange) {
              badgeVariant = "bg-amber-100 text-amber-700 uppercase tracking-wider text-[10px] shadow-none";
              badgeText = "LUAR RADIUS";
            } else {
              badgeVariant = "bg-[#6be4b6] text-emerald-900 uppercase tracking-wider text-[10px] shadow-none font-bold border-none";
              badgeText = "TEPAT WAKTU";
            }
          }

          return (
            <div key={u.id} className={cardClasses}>
              {/* Header Card */}
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="relative">
                    <Avatar className="h-14 w-14 border border-stone-200 shadow-sm ring-4 ring-white">
                      <AvatarImage src={u.photo_url || `https://i.pravatar.cc/150?u=${u.id}`} className="object-cover" />
                      <AvatarFallback className="bg-stone-200 text-stone-500 font-bold text-lg">{u.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {/* Status Dot */}
                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white 
                      ${isWaiting ? 'bg-stone-300' : isLate ? 'bg-amber-500' : 'bg-emerald-600'}`
                    }></div>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-stone-900 tracking-tight">{u.name}</h4>
                    <p className="text-xs font-medium text-stone-500 mt-0.5">{u.role}</p>
                  </div>
                </div>
                <Badge className={badgeVariant}>{badgeText}</Badge>
              </div>

              {/* Data Detail Card */}
              {!isWaiting ? (
                <>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100/60 border-dashed">
                    <div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Check-In</p>
                      <p className="text-xl font-bold text-stone-900 tracking-tight">
                        {new Date(u.log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Lokasi</p>
                      <div className="flex items-center gap-1.5 text-stone-700 text-sm font-medium">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        Dalam Radius ({u.log.distance_from_office != null ? Math.round(u.log.distance_from_office) : '?'}m)
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center overflow-hidden opacity-50 grayscale bg-white">
                       <MapPin className="h-5 w-5 text-rose-500" />
                    </div>
                    <AttendanceModal user={u} log={u.log} />
                  </div>
                </>
              ) : (
                <div className="pt-4 border-t border-stone-100/60 flex flex-col justify-between h-full gap-6">
                  <p className="text-sm italic text-stone-400">Belum melakukan check-in hari ini</p>
                  <div className="flex justify-end">
                    {u.phone ? (
                      <a href={`https://wa.me/${u.phone.replace(/[^0-9]/g, '')}?text=Halo%20${encodeURIComponent(u.name)},%20jangan%20lupa%20untuk%20melakukan%20Check-In%20presensi%20hari%20ini%20ya!`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" className="text-stone-700 font-bold text-sm tracking-wide bg-stone-200/50 hover:bg-stone-200">
                          Ingatkan via WA
                        </Button>
                      </a>
                    ) : (
                      <Button variant="ghost" disabled className="text-stone-400 font-bold text-sm tracking-wide bg-stone-100">
                        Ingatkan Staff
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {finalUsers.length === 0 && (
          <div className="col-span-1 lg:col-span-2 py-20 text-center flex flex-col items-center">
             <UserCheck className="h-10 w-10 text-stone-300 mb-3" />
             <p className="text-stone-500 font-medium tracking-wide">Data staff kosong atau filter tidak ditepat.</p>
          </div>
        )}
      </div>
    </div>
  );
}
