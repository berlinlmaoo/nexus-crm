"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Box, CheckCircle2, RotateCcw, Search, XCircle } from "lucide-react";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ScanPage() {
  const router = useRouter();
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState<"idle" | "scanning" | "loading" | "success" | "error">("idle");
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const playBeep = () => {
    // Simple beep sound for successful scan
    const audioContent = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
    audioContent.play().catch(() => {});
  };

  const handleSearchProduct = async (code: string) => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(code)}`);
      const payload = await res.json();

      if (!res.ok || !payload.data) {
        setStatus("error");
        setErrorMessage(`Barang dengan kode/barcode "${code}" tidak ditemukan di database.`);
        return;
      }

      playBeep();
      setScanResult(payload.data);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage("Terjadi kesalahan jaringan saat mencari ke server.");
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setManualCode("");
    setStatus("idle");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleSearchProduct(manualCode.trim());
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Scanner Barang</h2>
          <p className="text-sm text-stone-500 mt-1">Pindai barcode atau ketik kode barang secara manual.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        {status === "idle" || status === "scanning" ? (
          <div>
            {/* Kamera Wrapper */}
            <div className="bg-stone-950 p-4">
              <BarcodeScanner onScanSuccess={handleSearchProduct} />
            </div>
            
            {/* Fallback Manual Input */}
            <div className="p-6 border-t border-stone-100 bg-stone-50/50">
              <p className="text-sm font-bold uppercase tracking-wider text-stone-400 mb-3 block text-center">
                Atau Ketik Kode Manual
              </p>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <Input 
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Contoh: BB-001..." 
                    className="pl-9 h-12 text-lg uppercase bg-white border-stone-200 focus-visible:ring-amber-500"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" className="h-12 px-6 font-bold bg-stone-800 hover:bg-stone-900 text-white">
                  Cari
                </Button>
              </form>
            </div>
          </div>
        ) : status === "loading" ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h3 className="text-lg font-bold text-stone-800">Mencari Database...</h3>
            <p className="text-stone-500 text-sm mt-1">Sistem sedang memeriksa master barang.</p>
          </div>
        ) : status === "success" && scanResult ? (
          <div className="p-10 flex flex-col items-center justify-center text-center bg-emerald-50/30">
            <div className="bg-emerald-100 text-emerald-600 rounded-full p-4 mb-6 shadow-inner ring-4 ring-emerald-50 content-box">
              <CheckCircle2 className="h-16 w-16" />
            </div>
            <h3 className="text-2xl font-black text-stone-900 mb-2">{scanResult.name}</h3>
            
            <div className="flex gap-4 mt-6">
              <div className="bg-white px-6 py-4 rounded-xl border border-stone-200 shadow-sm min-w-[120px]">
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">Kode</p>
                <p className="text-xl font-bold text-stone-800">{scanResult.code}</p>
              </div>
              <div className="bg-white px-6 py-4 rounded-xl border border-stone-200 shadow-sm min-w-[120px]">
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">Stok Tersedia</p>
                <p className="text-xl font-bold text-amber-500">
                  {scanResult.current_stock} <span className="text-sm text-stone-500 font-medium">{scanResult.unit}</span>
                </p>
              </div>
            </div>

            <div className="mt-10 flex gap-3 w-full">
              <Button onClick={resetScan} variant="outline" className="flex-1 h-12 font-bold text-stone-600 bg-white">
                <RotateCcw className="h-4 w-4 mr-2" /> Scan Lagi
              </Button>
              <Button onClick={() => router.push(`/stock/${scanResult.id}`)} className="flex-1 h-12 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
                Update Stok <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="p-10 flex flex-col items-center justify-center text-center bg-rose-50/30">
            <div className="bg-rose-100 text-rose-600 rounded-full p-4 mb-6 shadow-inner ring-4 ring-rose-50">
              <XCircle className="h-16 w-16" />
            </div>
            <h3 className="text-2xl font-black text-stone-900 mb-2">Tidak Ditemukan!</h3>
            <p className="text-stone-600 max-w-sm mb-10">{errorMessage}</p>

            <Button onClick={resetScan} className="h-12 px-8 font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-md">
              <RotateCcw className="h-4 w-4 mr-2" /> Ulangi Scan
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
