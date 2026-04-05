import { createClient } from '@/lib/supabase/server';
import { Camera, MapPin, UserCheck, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function AttendanceLogPage() {
  const supabase = createClient();
  
  // Fetch attendance records with related user
  const { data: logs, error } = await supabase
    .from('attendance')
    .select(`
      *,
      users:user_id (name, role)
    `)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error("Fetch error:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Log Absensi</h2>
          <p className="text-stone-500 mt-1">Pantau kehadiran staf secara *real-time* berbasis jarak dan waktu.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-stone-700 bg-white shadow-sm font-semibold">
            <Filter className="h-4 w-4 mr-2 text-stone-400" />
            Filter
          </Button>
          <Link href="/attendance/checkin">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-500/20">
              <Camera className="h-4 w-4 mr-2" />
              Check In / Out
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Hadir Hari Ini</h3>
          <span className="text-3xl font-black text-emerald-600 block mt-2">12 <span className="text-sm font-bold text-emerald-600/50">/ 15 Staff</span></span>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider">Terlambat</h3>
          <span className="text-3xl font-black text-rose-600 block mt-2">2 <span className="text-sm font-bold text-rose-600/50">Staff</span></span>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
              placeholder="Cari nama staff..." 
              className="pl-9 bg-white border-stone-200 focus-visible:ring-emerald-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-stone-600">Pegawai</TableHead>
                <TableHead className="font-bold text-stone-600">Waktu & Tanggal</TableHead>
                <TableHead className="font-bold text-stone-600">Event</TableHead>
                <TableHead className="font-bold text-stone-600">Jarak Lokasi (m)</TableHead>
                <TableHead className="text-center font-bold text-stone-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => {
                const isLate = log.status === 'LATE';
                const isOutRange = log.status === 'OUT_OF_RANGE';
                
                return (
                  <TableRow key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden">
                            {log.photo_url ? (
                              <img src={log.photo_url} alt="Snap" className="w-full h-full object-cover" />
                            ) : (
                              <UserCheck className="w-5 h-5 mx-auto mt-1.5 text-stone-400" />
                            )}
                        </div>
                        <div>
                          <p className="font-bold text-stone-800">{log.users?.name || 'Unknown'}</p>
                          <p className="text-xs font-bold text-stone-400 tracking-wider uppercase">{log.users?.role || 'Staff'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-stone-700">{new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                      <p className="text-xs text-stone-500">{new Date(log.timestamp).toLocaleDateString('id-ID')}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={log.check_type === 'IN' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-stone-100 text-stone-600 border-stone-200'}>
                        {log.check_type === 'IN' ? 'CHECK IN' : 'CHECK OUT'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-stone-600 font-medium">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        {log.distance_from_office != null ? `${Math.round(log.distance_from_office)} meter` : 'Tidak Terdeteksi'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={
                          isLate ? "bg-amber-100 text-amber-700 border-amber-200 shadow-none" :
                          isOutRange ? "bg-rose-100 text-rose-700 border-rose-200 shadow-none" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {log.status || "ONTIME"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {(!logs || logs.length === 0) && (
            <div className="py-20 text-center flex flex-col items-center">
              <Camera className="h-10 w-10 text-stone-300 mb-3" />
              <p className="text-stone-500 font-medium">Belum ada riwayat absensi terekam.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
