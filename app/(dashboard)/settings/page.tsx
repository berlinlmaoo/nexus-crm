"use client";

import { useState, useEffect } from "react";
import {
  Settings, MapPin, Clock, Building2, Save, Loader2,
  Navigation, Users, Shield, Bell, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Config = {
  id?: string;
  restaurant_name: string;
  logo_url: string;
  office_lat: string;
  office_lng: string;
  radius_meter: string;
  work_start_time: string;
  work_end_time: string;
  late_tolerance_minutes: string;
};

const defaultConfig: Config = {
  restaurant_name: '',
  logo_url: '',
  office_lat: '',
  office_lng: '',
  radius_meter: '100',
  work_start_time: '08:00',
  work_end_time: '17:00',
  late_tolerance_minutes: '15',
};

function SectionCard({ icon: Icon, title, description, color, children }: any) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-6 py-4 border-b border-stone-100 flex items-center gap-3`}>
        <div className={`${color} p-2 rounded-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-stone-800">{title}</h3>
          <p className="text-xs text-stone-400">{description}</p>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-stone-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const supabase = createClient();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.data) {
        setConfig({
          restaurant_name:        json.data.restaurant_name || '',
          logo_url:               json.data.logo_url || '',
          office_lat:             json.data.office_lat?.toString() || '',
          office_lng:             json.data.office_lng?.toString() || '',
          radius_meter:           json.data.radius_meter?.toString() || '100',
          work_start_time:        json.data.work_start_time || '08:00',
          work_end_time:          json.data.work_end_time || '17:00',
          late_tolerance_minutes: json.data.late_tolerance_minutes?.toString() || '15',
        });
      }
    } catch (e) {
      toast.error("Gagal memuat pengaturan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const set = (key: keyof Config, value: string) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung GPS.");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('office_lat', pos.coords.latitude.toFixed(7));
        set('office_lng', pos.coords.longitude.toFixed(7));
        setGettingLocation(false);
        toast.success("📍 Koordinat kantor berhasil dideteksi!");
      },
      (err) => {
        toast.error("Gagal mendapatkan lokasi: " + err.message);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      setUploadingLogo(true);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      set('logo_url', data.publicUrl);
      toast.success("Logo diunggah. Jangan lupa klik Simpan Perubahan.");
    } catch (error: any) {
      toast.error("Gagal mengunggah logo: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!config.restaurant_name.trim()) {
      toast.warning("Nama restoran wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name:        config.restaurant_name,
          logo_url:               config.logo_url,
          office_lat:             config.office_lat ? parseFloat(config.office_lat) : null,
          office_lng:             config.office_lng ? parseFloat(config.office_lng) : null,
          radius_meter:           parseInt(config.radius_meter) || 100,
          work_start_time:        config.work_start_time,
          work_end_time:          config.work_end_time,
          late_tolerance_minutes: parseInt(config.late_tolerance_minutes) || 15,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Gagal menyimpan: " + json.error);
      } else {
        toast.success("✅ " + json.message);
      }
    } catch (e: any) {
      toast.error("Network error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-500 font-medium">Memuat pengaturan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Settings</h2>
          <p className="text-stone-500 mt-1">Konfigurasi restoran, lokasi kantor, dan aturan absensi.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchConfig} variant="outline" className="font-semibold text-stone-700">
            <RefreshCw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 shadow-md shadow-amber-500/20"
          >
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</>
              : <><Save className="h-4 w-4 mr-2" /> Simpan Perubahan</>
            }
          </Button>
        </div>
      </div>

      {/* Section 1: Identitas Restoran */}
      <SectionCard
        icon={Building2}
        title="Identitas Restoran"
        description="Nama dan informasi dasar bisnis"
        color="bg-amber-500"
      >
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 flex flex-col items-center">
             <div className="h-24 w-24 rounded-2xl bg-stone-100 border-2 border-stone-200 overflow-hidden flex items-center justify-center mb-3">
               {config.logo_url ? (
                 <img src={config.logo_url} alt="Logo" className="w-full h-full object-contain" />
               ) : (
                 <Building2 className="h-8 w-8 text-stone-300" />
               )}
             </div>
             <div>
               <Input type="file" id="logoUpload" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
               <label htmlFor="logoUpload" className="inline-block w-full">
                 <div className={`w-full text-center px-3 py-1 border border-stone-200 rounded-md text-xs font-bold cursor-pointer transition-colors ${uploadingLogo ? 'bg-stone-100 text-stone-400' : 'bg-white text-stone-700 hover:bg-stone-50'}`}>
                   {uploadingLogo ? "Mengunggah..." : "Ubah Logo"}
                 </div>
               </label>
             </div>
          </div>
          <div className="flex-1">
            <Field label="Nama Restoran" hint="Akan ditampilkan di header dan laporan">
              <Input
                value={config.restaurant_name}
                onChange={e => set('restaurant_name', e.target.value)}
                placeholder="Contoh: Warung Bu Sari"
                className="text-base font-medium"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* Section 2: Lokasi Kantor / Geofencing */}
      <SectionCard
        icon={MapPin}
        title="Lokasi Kantor & Geofencing"
        description="Titik pusat absensi dan radius check-in yang diizinkan"
        color="bg-emerald-500"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude" hint="Koordinat lintang kantor">
            <Input
              type="number"
              step="0.0000001"
              value={config.office_lat}
              onChange={e => set('office_lat', e.target.value)}
              placeholder="-6.2088"
              className="font-mono"
            />
          </Field>
          <Field label="Longitude" hint="Koordinat bujur kantor">
            <Input
              type="number"
              step="0.0000001"
              value={config.office_lng}
              onChange={e => set('office_lng', e.target.value)}
              placeholder="106.8456"
              className="font-mono"
            />
          </Field>
        </div>

        <Button
          onClick={handleGetLocation}
          disabled={gettingLocation}
          variant="outline"
          className="w-full font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        >
          {gettingLocation
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mendeteksi lokasi...</>
            : <><Navigation className="h-4 w-4 mr-2" /> Deteksi Lokasi Saya Sekarang</>
          }
        </Button>

        {config.office_lat && config.office_lng && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-mono text-center">
            📍 {parseFloat(config.office_lat).toFixed(6)}, {parseFloat(config.office_lng).toFixed(6)}
          </div>
        )}

        <Field label="Radius Geofencing (meter)" hint="Jarak maksimal dari kantor untuk bisa check-in">
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="10"
              max="5000"
              value={config.radius_meter}
              onChange={e => set('radius_meter', e.target.value)}
              className="font-mono w-32"
            />
            <div className="flex-1 bg-stone-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (parseInt(config.radius_meter) / 1000) * 100)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-stone-600">{config.radius_meter}m</span>
          </div>
        </Field>
      </SectionCard>

      {/* Section 3: Jam Kerja & Absensi */}
      <SectionCard
        icon={Clock}
        title="Jam Kerja & Aturan Absensi"
        description="Jadwal kerja dan toleransi keterlambatan"
        color="bg-sky-500"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Jam Masuk" hint="Waktu check-in standar">
            <Input
              type="time"
              value={config.work_start_time}
              onChange={e => set('work_start_time', e.target.value)}
              className="font-mono text-lg font-bold text-sky-700"
            />
          </Field>
          <Field label="Jam Pulang" hint="Waktu check-out standar">
            <Input
              type="time"
              value={config.work_end_time}
              onChange={e => set('work_end_time', e.target.value)}
              className="font-mono text-lg font-bold text-sky-700"
            />
          </Field>
        </div>

        <Field label="Toleransi Keterlambatan (menit)" hint="Berapa menit setelah jam masuk masih dianggap tepat waktu">
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="0"
              max="120"
              value={config.late_tolerance_minutes}
              onChange={e => set('late_tolerance_minutes', e.target.value)}
              className="font-mono w-32"
            />
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-2 text-sm text-sky-700 font-bold">
              Check-in sebelum {(() => {
                const [h, m] = config.work_start_time.split(':').map(Number);
                const total  = h * 60 + m + parseInt(config.late_tolerance_minutes || '0');
                return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
              })()} = Tepat Waktu
            </div>
          </div>
        </Field>

        {/* Visual summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Ringkasan Jadwal</p>
          <div className="flex items-center gap-3 text-sm">
            <div className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-lg">{config.work_start_time}</div>
            <div className="flex-1 h-px bg-stone-200 relative">
              <div className="absolute top-1/2 left-0 -translate-y-1/2 bg-amber-400 h-1 rounded" style={{
                width: `${Math.min(100, (parseInt(config.late_tolerance_minutes) / 60) * 100)}%`
              }}/>
            </div>
            <div className="bg-amber-100 text-amber-700 font-bold px-3 py-1.5 rounded-lg text-xs">+{config.late_tolerance_minutes}m</div>
            <div className="flex-1 h-px bg-stone-200" />
            <div className="bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-lg">{config.work_end_time}</div>
          </div>
        </div>
      </SectionCard>

      {/* Save button bottom */}
      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-10 shadow-lg shadow-amber-500/25"
        >
          {saving
            ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Menyimpan...</>
            : <><Save className="h-5 w-5 mr-2" /> Simpan Semua Perubahan</>
          }
        </Button>
      </div>
    </div>
  );
}
