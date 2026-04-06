"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle2, RotateCcw, ScanLine, Search, 
  Send, Loader2, PackageSearch, Activity 
} from "lucide-react";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  const [users, setUsers] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Scan state
  const [scannedCounts, setScannedCounts] = useState<Record<string, number>>({});
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedUser, setSelectedUser] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, uRes] = await Promise.all([
          fetch('/api/opname'),
          fetch('/api/users'),
        ]);
        const [pJson, uJson] = await Promise.all([pRes.json(), uRes.json()]);
        
        if (pJson.data) {
          const db: Record<string, MasterProduct> = {};
          pJson.data.forEach((p: MasterProduct) => {
            // Index by ID AND by Code for quick barcode lookup
            db[p.id] = p;
            db[p.code.toLowerCase()] = p; // In case barcode matches code exactly
          });
          setMasterDb(db);
        }
        if (uJson.data) setUsers(uJson.data);
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
    const focusInterval = setInterval(() => {
      if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT' && document.activeElement?.tagName !== 'INPUT') {
        inputRef.current?.focus();
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

    // Check frontend cache first
    let product_id = "";
    if (masterDb[c]) product_id = masterDb[c].id;
    else if (masterDb[c.toLowerCase()]) product_id = masterDb[c.toLowerCase()].id;
    else {
      // Fetch from API to see if it's a barcode distinct from the sku code
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(c)}`);
        const payload = await res.json();
        if (res.ok && payload.data) {
          product_id = payload.data.id;
        }
      } catch (err) {}
    }

    if (!product_id) {
      toast.error(`Barcode "${c}" tidak ditemukan.`);
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
        body: JSON.stringify({ 
          items: payloadItems, 
          user_id: selectedUser || null, 
          notes 
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Error: " + json.error);
        setStatus("idle");
      } else {
        setResult(json);
        setStatus("success");
        toast.success("Opname selesai dicatat!");
      }
    } catch (e: any) {
      toast.error("Network error: " + e.message);
      setStatus("idle");
    }
  };

  const resetAll = () => {
    setScannedCounts({});
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
          <Button onClick={() => { router.refresh(); router.push('/opname'); }} variant="outline" className="flex-1 h-12 font-bold">
            Riwayat Opname
          </Button>
          <Button onClick={() => { router.refresh(); router.push('/stock'); }} className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold">
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
        autoFocus
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
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Petugas Opname</label>
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">-- Pilih Staf Pengecek --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
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
