"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Box, CheckCircle2, RotateCcw, PackageMinus, PackagePlus, AlertTriangle, Send, Loader2, ScanBarcode, NotebookPen, Printer } from "lucide-react";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { segarkanData } from "@/app/actions";

/**
 * Satu baris keranjang = satu barang FISIK yang stikernya barusan discan, bukan "barang X
 * sebanyak N". Itu perbedaan yang bikin stiker ada gunanya: nomor yang udah keluar ditolak,
 * dan nomor yang sama nggak bisa nambah hitungan dua kali.
 */
type ScannedUnit = {
  serial: string;
  product_id: string;
  name: string;
  code: string;
  unit: string;
};

export default function StockTransactionScanPage() {
  const router = useRouter();
  
  // Tiga mode. "IN" di sini BUKAN bikin barang baru — nomornya udah lahir di halaman Barang
  // Masuk. Yang terjadi di sini validasi: stiker yang udah ditempel di barang fisiknya ditembak,
  // dan baru DI SINI stoknya naik. Jadi stiker yang dicetak tapi barangnya nggak pernah nyampe
  // nggak akan pernah kehitung jadi stok.
  const [mode, setMode] = useState<"IN" | "OUT" | "WASTE">("OUT");
  const [items, setItems] = useState<Record<string, ScannedUnit>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [notes, setNotes] = useState("");
  
  // Hard scanner capturing state
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const playBeep = () => {
    try {
      const audioContent = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
      audioContent.volume = 0.5;
      audioContent.play().catch(() => {});
    } catch(e) {}
  };

  useEffect(() => {
    // Cuma buat scanner FISIK (model keyboard-wedge) yang butuh fokus nempel terus. Di
    // perangkat sentuh alat kayak gitu nggak ada, sedangkan efek sampingnya nyata: browser
    // nge-scroll ke input tersembunyi tiap kali difokus, jadi halaman mental ke atas tiap
    // detik sambil ngangkat keyboard di layar.
    const pakaiSentuhan = typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (pakaiSentuhan) return;

    const focusInterval = setInterval(() => {
      if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.id !== 'manual-code-input') {
        // preventScroll: fokus boleh pindah, tapi jangan sampai nyeret tampilan.
        inputRef.current?.focus({ preventScroll: true });
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const handleBarcodeSubmit = async (code: string) => {
    const serial = code.trim().toUpperCase();
    if (!serial) return;

    // Ditolak di sini kalau nomornya udah ada di keranjang. Tanpa ini, nembak stiker yang sama
    // dua kali bakal keitung dua unit padahal barangnya cuma satu.
    if (items[serial]) {
      toast.warning(`${serial} udah ada di keranjang.`);
      return;
    }

    try {
      const res = await fetch(`/api/stock/units?serial=${encodeURIComponent(serial)}`);
      const payload = await res.json();

      if (!res.ok || !payload.data) {
        toast.error(payload.error || `Nomor "${serial}" nggak terdaftar.`);
        return;
      }

      const unit = payload.data;

      // Status yang "sah" beda tergantung mode. Di mode IN yang dicari justru unit yang MASIH
      // menunggu validasi; di mode keluar/rusak yang dicari yang udah jadi stok.
      if (mode === "IN") {
        if (unit.status !== 'PENDING') {
          toast.error(
            unit.status === 'IN_STOCK'
              ? `${serial} udah divalidasi masuk sebelumnya.`
              : `${serial} udah keluar dari gudang, nggak bisa divalidasi masuk lagi.`,
            { duration: 8000 }
          );
          return;
        }
      } else if (unit.status !== 'IN_STOCK') {
        if (unit.status === 'PENDING') {
          toast.error(`${serial} belum divalidasi masuk. Tembak dulu di mode Barang Masuk.`, { duration: 8000 });
          return;
        }
        // Inilah gunanya nomor per unit: stiker yang disimpen terus dipakai lagi ketahuan di
        // sini, lengkap sama kapan dan sama siapa unit itu keluar.
        const kapan = unit.consumed_at
          ? new Date(unit.consumed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'waktu nggak tercatat';
        const siapa = unit.consumer?.name || 'akun terhapus';
        toast.error(
          `${serial} udah ${unit.status === 'USED' ? 'keluar' : 'dibuang'} ${kapan} oleh ${siapa}.`,
          { duration: 8000 }
        );
        return;
      }

      playBeep();
      setItems(prev => ({
        ...prev,
        [serial]: {
          serial,
          product_id: unit.products?.id ?? unit.product_id,
          name: unit.products?.name ?? '(barang terhapus)',
          code: unit.products?.code ?? '',
          unit: unit.products?.unit ?? '',
        },
      }));

    } catch (err) {
      toast.error("Terjadi kesalahan sistem.");
    }
  };

  const handleHardScannerKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit(barcodeBuffer);
      setBarcodeBuffer("");
    }
  };

  const handleSubmitTransaction = async () => {
    const serials = Object.keys(items);
    if (serials.length === 0) return;

    setStatus("loading");
    try {
      // Mode IN jalannya ke endpoint yang beda: dia mindahin unit dari "menunggu validasi" jadi
      // stok, bukan ngeluarin barang.
      const res = mode === "IN"
        ? await fetch('/api/stock/units/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serials, notes })
          })
        : await fetch('/api/stock/units/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serials, type: mode, notes })
          });

      const result = await res.json();
      // Pesan dari server itu yang paling berguna ("Unit X udah keluar tanggal Y oleh Z"),
      // jadi ditampilin apa adanya dan agak lama biar sempat kebaca.
      if (!res.ok) {
        toast.error(result.error || "Gagal nyatet transaksi", { duration: 8000 });
        setStatus("idle");
        return;
      }

      setStatus("success");
      toast.success("Transaksi dicatat!");
      // Cache dibuang duluan; kalau nggak, daftar stok yang dituju bakal nampilin angka
      // sebelum transaksi ini.
      await segarkanData(["/stock", "/purchasing", "/"]);
      setTimeout(() => {
        router.push('/stock');
        router.refresh();
      }, 1500);

    } catch (e: any) {
      toast.error("Gagal: " + e.message);
      setStatus("idle");
    }
  };

  const resetAll = () => {
    setItems({});
    setBarcodeBuffer("");
    setStatus("idle");
    inputRef.current?.focus();
  };

  const scannedList = Object.values(items);
  const totalUnits = scannedList.length;

  // Struk dikelompokin per barang biar kebaca "beras 3 karung", bukan tiga baris beras yang
  // keliatan kayak tiga barang berbeda. Nomor unitnya tetap dicetak di bawahnya — itu yang
  // dicocokin sama stiker di tangan.
  const perBarang = Object.values(
    scannedList.reduce((acc, u) => {
      (acc[u.product_id] ||= { name: u.name, code: u.code, unit: u.unit, serials: [] }).serials.push(u.serial);
      return acc;
    }, {} as Record<string, { name: string; code: string; unit: string; serials: string[] }>)
  ).map(g => ({ ...g, serials: g.serials.sort() }));

  if (status === "success") {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-100 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-xl border border-stone-200 animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-emerald-50">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h3 className="text-3xl font-black text-stone-900 mb-2 mt-4 tracking-tight">Selesai!</h3>
          <p className="text-stone-500 mb-8 font-medium">Transaksi stok berhasil diverifikasi & dicatat.</p>
          <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 w-full animate-[progress_1.5s_ease-out_forwards]"></div>
          </div>
        </div>
      </div>
    );
  }

  // Tema + label per mode, dikumpulin di satu tempat.
  //
  // Tiap mode nyentuh LIMA titik di halaman ini: tombol pilihannya, bingkai area scan, titik
  // status "Sistem Siaga", judul struk, dan tombol validasi. Sebelumnya itu semua ternary
  // dua-cabang (`mode === "OUT" ? amber : rose`) yang diam-diam bener selama cuma ada dua mode —
  // begitu mode ketiga masuk, tiap ternary yang kelewat bakal ngasih warna WASTE ke Barang Masuk.
  const MODES = {
    IN: {
      label: "Barang Masuk", icon: PackagePlus, struk: "PENERIMAAN",
      frame: "from-emerald-500/20 to-emerald-100 text-emerald-800 border-emerald-200",
      aktif: "bg-white text-emerald-600 shadow-md ring-2 ring-emerald-500 scale-[1.02]",
      ping: "bg-emerald-500", pingSoft: "bg-emerald-400",
      tombol: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25",
    },
    OUT: {
      label: "Barang Keluar", icon: PackageMinus, struk: "PENGELUARAN",
      frame: "from-amber-500/20 to-amber-100 text-amber-800 border-amber-200",
      aktif: "bg-white text-amber-600 shadow-md ring-2 ring-amber-500 scale-[1.02]",
      ping: "bg-amber-500", pingSoft: "bg-amber-400",
      tombol: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25",
    },
    WASTE: {
      label: "Bocor / Rusak", icon: AlertTriangle, struk: "PENGHAPUSAN",
      frame: "from-rose-500/20 to-rose-100 text-rose-800 border-rose-200",
      aktif: "bg-white text-rose-600 shadow-md ring-2 ring-rose-500 scale-[1.02]",
      ping: "bg-rose-500", pingSoft: "bg-rose-400",
      tombol: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25",
    },
  } as const;

  const M = MODES[mode];
  const activeColor = M.frame;

  return (
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6 px-1 sm:px-0 pb-20">
      
      {/* Hidden Global Input trap */}
      <input 
        ref={inputRef}
        type="text" 
        className="opacity-0 absolute w-0 h-0" 
        value={barcodeBuffer}
        onChange={e => setBarcodeBuffer(e.target.value)}
        onKeyDown={handleHardScannerKeyPress}
      />

      {/* Header and Big Mode Toggles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5 text-stone-600" />
          </Button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 flex items-center gap-3">
              <ScanBarcode className="w-7 h-7 text-amber-500" />
              Terminal Stok
            </h2>
            <p className="text-stone-500 font-medium">Tembak barcode, atau ketik kodenya kalau scanner lagi nggak ada.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4 bg-stone-100 p-2 md:p-3 rounded-2xl shadow-inner border border-stone-200">
        {(["IN", "OUT", "WASTE"] as const).map((m) => {
          const cfg = MODES[m];
          const Ikon = cfg.icon;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex flex-col items-center justify-center p-3 md:p-4 rounded-xl font-bold transition-all duration-300",
                mode === m ? cfg.aktif : "text-stone-500 hover:bg-stone-200 hover:text-stone-700"
              )}
            >
              <Ikon className={cn("w-7 h-7 md:w-8 md:h-8 mb-2 transition-transform", mode === m && "scale-110")} />
              <span className="text-[10px] md:text-sm tracking-widest uppercase text-center leading-tight">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode IN di sini cuma buat MEMVALIDASI stiker yang udah dicetak. Nomor unitnya sendiri
          lahir di halaman Barang Masuk — kalau belum lewat sana, nggak ada yang bisa ditembak. */}
      {mode === "IN" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p>
            <span className="font-bold">Tembak stiker barang yang baru dateng.</span> Stoknya naik
            pas divalidasi di sini, bukan pas stikernya dicetak.
          </p>
          <Link href="/stock/receive" className="mt-1 inline-block font-bold underline underline-offset-2">
            Stikernya belum dibikin? Ke halaman Barang Masuk
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_450px] gap-6 items-start">
        
        {/* Left Side: Scanning area */}
        <div className="flex flex-col gap-6">
          
          <div className={cn("rounded-3xl border-2 p-6 transition-colors shadow-sm bg-gradient-to-b", activeColor)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Titik Pemindaian (Scanner)</span>
                <h3 className="font-black text-xl">Tembak Stiker Barangnya</h3>
              </div>
              <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-black/5">
                <span className="relative flex h-3 w-3">
                  <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", M.pingSoft)}></span>
                  <span className={cn("relative inline-flex rounded-full h-3 w-3", M.ping)}></span>
                </span>
                <span className="text-xs font-bold uppercase">Sistem Siaga</span>
              </div>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-inner border border-stone-200">
               <BarcodeScanner onScanSuccess={handleBarcodeSubmit} />
            </div>
            
            {/* The Bypass Block - Redesigned to be useful */}
            <div className="mt-4 bg-white/60 backdrop-blur rounded-2xl p-4 border border-black/5">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                <NotebookPen className="w-4 h-4" /> Atau Input Manual (Mode Bypass Demo)
              </label>
              <div className="flex gap-2">
                <Input 
                  id="manual-code-input"
                  placeholder="Ketik NOMOR UNIT (misal: BB-001-0001) di sini..."
                  className="bg-white h-12 text-center font-bold tracking-widest text-lg shadow-sm border-stone-300 focus-visible:ring-black/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeSubmit(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <textarea 
            placeholder="Tambahkan catatan khusus untuk seluruh transaksi ini..." 
            className="w-full text-sm p-5 rounded-3xl border border-stone-200 bg-white focus:ring-2 focus:ring-amber-500 resize-none h-32 shadow-sm font-medium"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Right Side: Receipt Cart */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden flex flex-col max-h-[70vh] lg:h-[700px] lg:max-h-none lg:sticky lg:top-6">
          <div className="bg-stone-900 text-white p-4 pb-6 sm:p-6 sm:pb-8 text-center relative overflow-hidden">
             {/* Receipt jagged edge effect using CSS */}
             <div className="absolute bottom-0 left-0 right-0 h-4 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMTBMMSAwaDdMNiAxMHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]"></div>
             
             <h3 className="font-extrabold text-2xl tracking-tight leading-none mb-1">STRUK TRANSAKSI</h3>
             <p className="text-stone-400 font-mono text-xs tracking-widest">{M.struk} BARANG</p>
          </div>
          
          <div className="flex-1 min-h-[120px] overflow-y-auto p-4 bg-[#f8f9fa] custom-scrollbar">
            {scannedList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-300">
                <Box className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-bold text-stone-400">Keranjang Kosong</p>
                <p className="text-xs text-stone-400 mt-1 max-w-[200px] text-center">Silakan scan barang menggunakan scanner atau kamera.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {perBarang.map(g => (
                  <div key={g.code} className="p-4 bg-white border border-stone-200 border-dashed rounded-xl shadow-sm relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-300"></div>
                    <div className="flex items-center justify-between pl-2">
                      <div className="min-w-0">
                        <p className="font-bold text-stone-800 text-[15px] leading-tight truncate">{g.name}</p>
                        <p className="text-[11px] text-stone-500 font-mono mt-1 opacity-70">{g.code}</p>
                      </div>
                      <div className="flex bg-stone-50 px-4 py-2 rounded-lg border border-stone-100 min-w-[70px] text-center justify-center items-end gap-1 shadow-inner shrink-0">
                        <span className="font-black text-2xl text-stone-900 leading-none">{g.serials.length}</span>
                        <span className="text-[10px] font-bold text-stone-400 mb-0.5">{g.unit}</span>
                      </div>
                    </div>
                    <div className="mt-3 pl-2 flex flex-wrap gap-1">
                      {g.serials.map(sn => (
                        <span key={sn} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">{sn}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 bg-white border-t-2 border-stone-100 border-dashed relative">
            
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-xs uppercase font-bold text-stone-400 tracking-wider">Total Discan</p>
                <div className="flex items-baseline gap-2 mt-1">
                   <p className="text-3xl font-black text-stone-800 leading-none">{totalUnits}</p>
                   <p className="text-sm font-bold text-stone-400 uppercase">Unit / Item</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => router.push('/stock')} className="text-stone-400 hover:text-amber-500 font-bold hover:bg-amber-50 rounded-full h-8 px-3 border border-stone-200 bg-white">
                  <Printer className="w-4 h-4 mr-1.5" /> Cetak Barcode Label
                </Button>
                <Button variant="ghost" size="sm" onClick={resetAll} className="text-stone-400 hover:text-rose-500 font-bold hover:bg-rose-50 rounded-full h-8 px-3">
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Batal
                </Button>
              </div>
            </div>
            
            <Button 
              onClick={handleSubmitTransaction}
              disabled={scannedList.length === 0 || status === "loading"}
              className={cn(
                "w-full h-14 text-lg font-black shadow-xl transition-all rounded-2xl",
                M.tombol,
                "text-white hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {status === "loading" ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
              {status === "loading" ? "Memproses..." : "VALIDASI TRANSAKSI"}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
