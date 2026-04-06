"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Box, CheckCircle2, RotateCcw, PackageMinus, PackagePlus, AlertTriangle, Send, Loader2, ScanBarcode, NotebookPen, Printer } from "lucide-react";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScannedItem = {
  product_id: string;
  name: string;
  code: string;
  unit: string;
  quantity: number;
};

export default function StockTransactionScanPage() {
  const router = useRouter();
  
  const [mode, setMode] = useState<"OUT" | "WASTE">("OUT");
  const [items, setItems] = useState<Record<string, ScannedItem>>({});
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
    const focusInterval = setInterval(() => {
      if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.id !== 'manual-code-input') {
        inputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const handleBarcodeSubmit = async (code: string) => {
    if (!code.trim()) return;
    
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(code)}`);
      const payload = await res.json();

      if (!res.ok || !payload.data) {
        toast.error(`Barcode "${code}" tidak sinkron. Coba ketik manual.`);
        return;
      }

      const product = payload.data;
      playBeep();
      
      setItems(prev => {
        const existing = prev[product.id];
        if (existing) {
          return { ...prev, [product.id]: { ...existing, quantity: existing.quantity + 1 }};
        } else {
          return { ...prev, [product.id]: { 
            product_id: product.id, 
            name: product.name, 
            code: product.code, 
            unit: product.unit, 
            quantity: 1 
          }};
        }
      });
      
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
    const payloadItems = Object.values(items);
    if (payloadItems.length === 0) return;
    
    setStatus("loading");
    try {
      const res = await fetch('/api/stock/update-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, type: mode, notes })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      setStatus("success");
      toast.success("Transaksi dicatat!");
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
  const totalItemTypes = scannedList.length;
  const totalUnits = scannedList.reduce((acc, curr) => acc + curr.quantity, 0);

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

  // Visual theming based on mode
  const modeColors = {
    IN: "from-teal-500/20 to-teal-100 text-teal-800 border-teal-200",
    OUT: "from-amber-500/20 to-amber-100 text-amber-800 border-amber-200",
    WASTE: "from-rose-500/20 to-rose-100 text-rose-800 border-rose-200"
  };

  const activeColor = modeColors[mode];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Hidden Global Input trap */}
      <input 
        ref={inputRef}
        type="text" 
        className="opacity-0 absolute w-0 h-0" 
        value={barcodeBuffer}
        onChange={e => setBarcodeBuffer(e.target.value)}
        onKeyDown={handleHardScannerKeyPress}
        autoFocus
      />

      {/* Header and Big Mode Toggles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5 text-stone-600" />
          </Button>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-stone-900 flex items-center gap-3">
              <ScanBarcode className="w-7 h-7 text-amber-500" />
              Terminal Stok
            </h2>
            <p className="text-stone-500 font-medium">Bypass manual tersedia untuk demo tanpa alat.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 bg-stone-100 p-2 md:p-3 rounded-2xl shadow-inner border border-stone-200">
        <button 
          onClick={() => setMode("OUT")}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl font-bold transition-all duration-300",
            mode === "OUT" ? "bg-white text-amber-600 shadow-md ring-2 ring-amber-500 scale-[1.02]" : "text-stone-500 hover:bg-stone-200 hover:text-stone-700"
          )}
        >
          <PackageMinus className={cn("w-8 h-8 mb-2 transition-transform", mode === "OUT" && "scale-110")} />
          <span className="text-[11px] md:text-sm tracking-widest uppercase">Barang Keluar</span>
        </button>
        <button 
          onClick={() => setMode("WASTE")}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl font-bold transition-all duration-300",
            mode === "WASTE" ? "bg-white text-rose-600 shadow-md ring-2 ring-rose-500 scale-[1.02]" : "text-stone-500 hover:bg-stone-200 hover:text-stone-700"
          )}
        >
          <AlertTriangle className={cn("w-8 h-8 mb-2 transition-transform", mode === "WASTE" && "scale-110")} />
          <span className="text-[11px] md:text-sm tracking-widest uppercase">Bocor / Rusak</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_450px] gap-6 items-start">
        
        {/* Left Side: Scanning area */}
        <div className="flex flex-col gap-6">
          
          <div className={cn("rounded-3xl border-2 p-6 transition-colors shadow-sm bg-gradient-to-b", activeColor)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Titik Pemindaian (Scanner)</span>
                <h3 className="font-black text-xl">Silakan Tembak Barcode</h3>
              </div>
              <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-full ring-1 ring-black/5">
                <span className="relative flex h-3 w-3">
                  <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", mode==="OUT"?"bg-amber-400":"bg-rose-400")}></span>
                  <span className={cn("relative inline-flex rounded-full h-3 w-3", mode==="OUT"?"bg-amber-500":"bg-rose-500")}></span>
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
                  placeholder="Ketik KODE BARANG (misal: SAPI) di sini..."
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
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden flex flex-col h-[700px] sticky top-6">
          <div className="bg-stone-900 text-white p-6 pb-8 text-center relative overflow-hidden">
             {/* Receipt jagged edge effect using CSS */}
             <div className="absolute bottom-0 left-0 right-0 h-4 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMTBMMSAwaDdMNiAxMHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]"></div>
             
             <h3 className="font-extrabold text-2xl tracking-tight leading-none mb-1">STRUK TRANSAKSI</h3>
             <p className="text-stone-400 font-mono text-xs tracking-widest">{mode === "OUT" ? "PENGELUARAN" : "PENGHAPUSAN"} BARANG</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-[#f8f9fa] custom-scrollbar">
            {scannedList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-300">
                <Box className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-bold text-stone-400">Keranjang Kosong</p>
                <p className="text-xs text-stone-400 mt-1 max-w-[200px] text-center">Silakan scan barang menggunakan scanner atau kamera.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scannedList.map(item => (
                  <div key={item.product_id} className="p-4 bg-white border border-stone-200 border-dashed rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-300"></div>
                    <div className="pl-2">
                      <p className="font-bold text-stone-800 text-[15px] leading-tight">{item.name}</p>
                      <p className="text-[11px] text-stone-500 font-mono mt-1 opacity-70">SKU: {item.code}</p>
                    </div>
                    <div className="flex bg-stone-50 px-4 py-2 rounded-lg border border-stone-100 min-w-[70px] text-center justify-center items-end gap-1 shadow-inner">
                      <span className="font-black text-2xl text-stone-900 leading-none">{item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t-2 border-stone-100 border-dashed relative">
            
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
                mode === "OUT" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25" : 
                "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25",
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
