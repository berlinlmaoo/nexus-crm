"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, CheckCircle2, RotateCcw, ScanLine, Search, 
  Send, Loader2, PackageSearch, Activity 
} from "lucide-react";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { segarkanData } from "@/app/actions";

type MasterProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
};

export default function BarcodeOpnamePage() {
  const router = useRouter();
  
  // Master data
  const [masterDb, setMasterDb] = useState<Record<string, MasterProduct>>({});
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Scan state
  const [scannedCounts, setScannedCounts] = useState<Record<string, number>>({});
  // Nomor unit yang udah ditembak di sesi ini. Tanpa ini, nembak stiker yang sama dua kali
  // bikin hitungan fisik naik dua — persis kesalahan yang bikin opname nggak ada gunanya.
  const [scannedSerials, setScannedSerials] = useState<Set<string>>(new Set());
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Daftar user nggak diambil lagi — petugasnya dari sesi, bukan dari dropdown.
        const pRes = await fetch('/api/opname');
        const pJson = await pRes.json();
        
        if (pJson.data) {
          const db: Record<string, MasterProduct> = {};
          pJson.data.forEach((p: MasterProduct) => {
            // Index by ID AND by Code for quick barcode lookup
            db[p.id] = p;
            db[p.code.toLowerCase()] = p; // In case barcode matches code exactly
          });
          setMasterDb(db);
        }
      } catch (e) {
        toast.error("Gagal memuat master data produk.");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Force hidden input focus
  useEffect(() => {
    // Cuma buat scanner FISIK (model keyboard-wedge) yang butuh fokus nempel terus. Di
    // perangkat sentuh alat kayak gitu nggak ada, sedangkan efek sampingnya nyata: browser
    // nge-scroll ke input tersembunyi tiap kali difokus, jadi halaman mental ke atas tiap
    // detik sambil ngangkat keyboard di layar.
    const pakaiSentuhan = typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (pakaiSentuhan) return;

    const focusInterval = setInterval(() => {
      if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT' && document.activeElement?.tagName !== 'INPUT') {
        // preventScroll: fokus boleh pindah, tapi jangan sampai nyeret tampilan.
        inputRef.current?.focus({ preventScroll: true });
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const playBeep = () => {
    try {
      const audioContent = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
      audioContent.volume = 0.5;
      audioContent.play().catch(() => {});
    } catch(e) {}
  };

  const processBarcode = async (code: string) => {
    const c = code.trim();
    if (!c) return;

    let product_id = "";

    // Stiker unit dulu (BB-001-0001) — itu yang nempel di barangnya sekarang. Kode barang
    // (BB-001) tetap diterima sebagai jalan mundur buat barang curah yang nggak punya unit.
    try {
      const res = await fetch(`/api/stock/units?serial=${encodeURIComponent(c)}`);
      const payload = await res.json();
      if (res.ok && payload.data) {
        const serial = payload.data.serial as string;
        if (scannedSerials.has(serial)) {
          toast.warning(`${serial} udah ditembak di sesi ini.`);
          return;
        }
        setScannedSerials(prev => new Set(prev).add(serial));
        product_id = payload.data.products?.id ?? payload.data.product_id;
      }
    } catch (err) {}

    if (!product_id) {
      if (masterDb[c]) product_id = masterDb[c].id;
      else if (masterDb[c.toLowerCase()]) product_id = masterDb[c.toLowerCase()].id;
      else {
        try {
          const res = await fetch(`/api/products/search?q=${encodeURIComponent(c)}`);
          const payload = await res.json();
          if (res.ok && payload.data) product_id = payload.data.id;
        } catch (err) {}
      }
    }

    if (!product_id) {
      toast.error(`"${c}" nggak ketemu — bukan nomor unit maupun kode barang.`);
      return;
    }

    playBeep();
    setScannedCounts(prev => ({
      ...prev,
      [product_id]: (prev[product_id] || 0) + 1
    }));
  };

  const handleHardScannerKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processBarcode(barcodeBuffer);
      setBarcodeBuffer("");
    }
  };

  const handleSubmit = async () => {
    const keys = Object.keys(scannedCounts);
    if (keys.length === 0) {
      toast.warning("Belum ada barang yang discan.");
      return;
    }

    setStatus("submitting");
    try {
      const payloadItems = keys.map(id => ({
        product_id: id,
        system_stock: masterDb[id].current_stock,
        physical_count: scannedCounts[id]
      }));

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Error: " + json.error);
        setStatus("idle");
      } else {
        setResult(json);
        setStatus("success");
        toast.success("Opname selesai dicatat!");
        // Opname nyetel ulang angka stok, jadi daftar stok dan dashboard wajib dibuang
        // cache-nya — itu justru halaman yang bakal dibuka orang habis ini.
        await segarkanData(["/opname", "/stock", "/"]);
      }
    } catch (e: any) {
      toast.error("Network error: " + e.message);
      setStatus("idle");
    }
  };

  const resetAll = () => {
    setScannedCounts({});
    setScannedSerials(new Set());
    setBarcodeBuffer("");
    inputRef.current?.focus();
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-stone-500 font-medium">Memuat master produk...</p>
      </div>
    );
  }

  if (status === "success" && result) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="mx-auto w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black text-stone-800">Opname Berhasil!</h2>
        <p className="text-stone-500 font-medium">{result.message}</p>

        {/* Barang yang ketemu lebih banyak dari yang terdaftar dapet nomor unit baru — tapi
            nomornya belum nempel di mana-mana. Selama stikernya belum dicetak dan ditempel,
            barang itu nggak bisa dikeluarin lewat scanner, jadi ini bukan info tambahan
            melainkan langkah yang belum selesai. */}
        {Array.isArray(result.serials_baru) && result.serials_baru.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left">
            <p className="font-bold text-amber-900">
              {result.serials_baru.length} unit baru kedaftar dari barang yang ketemu lebih banyak.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Stikernya belum dicetak. Selama belum ditempel, unit ini nggak bisa dikeluarin lewat scanner.
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {result.serials_baru.map((sn: string) => (
                <span key={sn} className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-amber-900 border border-amber-200">{sn}</span>
              ))}
            </div>
            {result.product_ids?.[0] && (
              <Link
                href={`/stock/${result.product_ids[0]}/print?serials=${encodeURIComponent(result.serials_baru.join(','))}`}
                className="mt-4 inline-block"
              >
                <Button className="h-11 px-6 font-bold bg-amber-500 hover:bg-amber-600 text-white">
                  Cetak {result.serials_baru.length} Stiker
                </Button>
              </Link>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-emerald-700">Item Selisih (Disesuaikan)</p>
            <p className="text-4xl font-black text-emerald-600 mt-1">{result.adjusted}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-amber-700">Total Di-Scan</p>
            <p className="text-4xl font-black text-amber-600 mt-1">{result.total}</p>
          </div>
        </div>
        
        <div className="flex gap-3 pt-6">
          <Button onClick={async () => { await segarkanData(['/opname']); router.push('/opname'); router.refresh(); }} variant="outline" className="flex-1 h-12 font-bold">
            Riwayat Opname
          </Button>
          <Button onClick={async () => { await segarkanData(['/stock', '/']); router.push('/stock'); router.refresh(); }} className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold">
            Lihat Stok Utama
          </Button>
        </div>
      </div>
    );
  }

  const scannedList = Object.keys(scannedCounts).map(id => ({
    id,
    product: masterDb[id],
    count: scannedCounts[id]
  })).sort((a, b) => b.count - a.count);

  const totalTypes = scannedList.length;
  const totalUnits = scannedList.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Hidden input for hardware scanner capture */}
      <input 
        ref={inputRef}
        type="text" 
        className="opacity-0 absolute w-0 h-0" 
        value={barcodeBuffer}
        onChange={e => setBarcodeBuffer(e.target.value)}
        onKeyDown={handleHardScannerKeyPress}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Validasi Stock Opname</h2>
            <p className="text-sm text-stone-500 mt-1">Sistem hitung menggunakan Scanner Tembak atau Kamera. Tembak tanpa henti.</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Left: Input Areas */}
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse relative ring-4 ring-emerald-500/20"></div>
            <p className="text-sm font-bold text-emerald-800">Scanner Aktif. Akumulasi jumlah per 1x Scan.</p>
          </div>

          <div className="bg-stone-950 p-4 rounded-2xl overflow-hidden shadow-inner relative flex flex-col items-center">
            <div className="w-full relative">
              <BarcodeScanner onScanSuccess={(code) => processBarcode(code)} />
            </div>
            <p className="text-center text-xs text-stone-500 mt-2 mb-4">Kamera Backup</p>
            
            <div className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 mt-2">
              <label className="text-[10px] uppercase font-bold tracking-wider text-amber-500 mb-2 block text-center">Bypass / Input Manual (Demo)</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Ketik kode barcode..."
                  className="bg-stone-950 border-stone-800 text-stone-300 font-mono text-sm h-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      processBarcode(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
              <p className="text-[9px] text-stone-500 mt-2 text-center">Ketik kode barang lalu tekan Enter.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
            {/* Dropdown "pilih petugas" dicabut: petugasnya diambil dari akun yang login.
                Opname itu satu-satunya jalur yang bisa nyetel stok ke angka berapa pun, jadi
                nama yang kecatat nggak boleh bisa dipilih sendiri sama yang ngirim. */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-sm font-bold text-stone-700">Petugas Opname</p>
              <p className="text-xs text-stone-500 mt-1">
                Tercatat otomatis atas nama akun yang lagi login.
              </p>
            </div>

            
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Catatan Kondisi</label>
              <textarea 
                placeholder="Ada kardus basah, lampu redup, dll..." 
                className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 outline-none focus:ring-1 focus:ring-amber-500 resize-none h-16"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right: Cart/Session List */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
          <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
            <h3 className="font-bold text-stone-800 uppercase tracking-widest text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Tercatat Fisik
            </h3>
            <Button variant="ghost" size="sm" onClick={resetAll} className="text-stone-400 hover:text-rose-500 font-bold text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Ulangi
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-stone-50/30">
            {scannedList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 py-10 px-4 text-center">
                <ScanLine className="w-16 h-16 mb-4 opacity-20 text-emerald-500" />
                <p className="font-medium text-sm">Menunggu Scan Barang...</p>
                <p className="text-xs mt-1 max-w-[250px]">Hasil pindai akan otomatis menumpuk jadi kuantitas. Semakin banyak di-scan, semakin tinggi jumlahnya.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scannedList.map(item => {
                  const p = item.product;
                  const diff = item.count - p.current_stock;
                  
                  return (
                    <div key={item.id} className="p-4 bg-white border border-stone-100 shadow-sm rounded-xl flex items-center justify-between animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <p className="font-bold text-stone-800 text-sm leading-tight">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">{p.code}</span>
                          <span className="text-xs text-stone-400 font-medium">Stok Sistem: {p.current_stock}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col items-end mr-2">
                           <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Selisih</span>
                           <span className={`text-sm font-black ${diff === 0 ? 'text-emerald-500' : diff > 0 ? 'text-sky-500' : 'text-rose-500'}`}>
                             {diff > 0 ? '+' : ''}{diff}
                           </span>
                         </div>
                        <div className="flex flex-col items-center justify-center bg-amber-50 p-2 rounded-xl border border-amber-200 min-w-16 h-14">
                          <span className="font-black text-2xl text-amber-700 leading-none">{item.count}</span>
                          <span className="text-[9px] font-bold text-amber-500 uppercase">{p.unit}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-stone-100 bg-white flex items-center justify-between shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10 relative">
            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Total Review</p>
              <p className="text-xl font-black text-stone-800">
                {totalTypes} <span className="text-sm font-bold text-stone-400">jenis</span> | {totalUnits} <span className="text-sm font-bold text-stone-400">fisik</span>
              </p>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={scannedList.length === 0 || status === "submitting"}
              className="h-12 font-bold shadow-lg shadow-amber-500/30 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl px-8 transition-all hover:scale-105 active:scale-95"
            >
              {status === "submitting" ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
              {status === "submitting" ? "Menyelesaikan..." : "Selesaikan Opname"}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
