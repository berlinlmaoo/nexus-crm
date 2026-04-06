"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, MapPin, Map, Camera, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AttendanceModalProps {
  user: any;
  log: any;
}

export default function AttendanceModal({ user, log }: AttendanceModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!log) return null;

  return (
    <>
      <Button 
        variant="link" 
        className="text-[#a26815] font-bold px-0 hover:text-amber-900 focus:outline-none"
        onClick={() => setIsOpen(true)}
      >
        Lihat Bukti Foto
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-stone-100">
              <h3 className="font-black text-stone-800 text-lg">Detail Absensi</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-full hover:bg-stone-100">
                <X className="h-5 w-5 text-stone-500" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-6">
              {/* User Bar */}
              <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                <Avatar className="h-12 w-12 border shadow-sm">
                  <AvatarImage src={user.photo_url || `https://i.pravatar.cc/150?u=${user.id}`} className="object-cover" />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-stone-900 text-lg tracking-tight leading-none">{user.name}</h4>
                  <p className="text-stone-500 text-sm mt-1">{user.role}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{log.check_type === 'IN' ? 'Check In' : 'Check Out'}</p>
                  <p className="font-bold text-stone-800 flex items-center justify-end gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>
              </div>

              {/* Grid 2 Columns for Map and Photo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Photo Side */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Bukti Foto
                  </h5>
                  <div className="rounded-2xl border-2 border-stone-100 overflow-hidden bg-stone-50 aspect-square flex items-center justify-center relative">
                    {log.photo_url ? (
                       <img src={log.photo_url} alt="Selfie" className="w-full h-full object-cover" />
                    ) : (
                       <div className="text-center p-4">
                         <Camera className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                         <p className="text-sm font-medium text-stone-400">Tidak ada foto</p>
                       </div>
                    )}
                  </div>
                </div>

                {/* Map Side */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Map className="w-4 h-4 text-amber-500" />
                    Lokasi Pemindaian
                  </h5>
                  <div className="rounded-2xl border-2 border-stone-100 overflow-hidden bg-stone-50 aspect-square relative">
                    {(log.latitude && log.longitude) ? (
                      <>
                        <iframe 
                          width="100%" 
                          height="100%" 
                          frameBorder="0" 
                          scrolling="no" 
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${log.longitude-0.003},${log.latitude-0.003},${log.longitude+0.003},${log.latitude+0.003}&layer=mapnik&marker=${log.latitude},${log.longitude}`}
                          className="opacity-90"
                        ></iframe>
                        <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-md rounded-xl p-3 shadow-md border border-stone-100/50">
                          <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5 leading-none">
                            <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                            Dalam Radius Tracker
                          </p>
                          <p className="text-[10px] text-stone-500 mt-1 ml-5">
                            Jarak ke restoran: {log.distance_from_office != null ? Math.round(log.distance_from_office) : '?'} meter
                          </p>
                        </div>
                      </>
                    ) : (
                       <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                         <Map className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                         <p className="text-sm font-medium text-stone-400">Lokasi GPS tidak terdeteksi</p>
                       </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
            
             {/* Footer Button Full Width */}
            <div className="bg-stone-50 p-4 border-t border-stone-100">
               <Button className="w-full font-bold bg-stone-900 hover:bg-stone-800 rounded-xl" onClick={() => setIsOpen(false)}>
                 Tutup
               </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
