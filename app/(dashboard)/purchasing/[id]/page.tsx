"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Truck, Loader2, Package, Printer, ScanBarcode, NotebookPen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  PENDING_MANAGER: { label: 'Menunggu Persetujuan Manager', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  PENDING_OWNER:   { label: 'Menunggu Persetujuan Owner',   color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: Clock },
  APPROVED:        { label: 'Disetujui - Menunggu Kedatangan',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  REJECTED:        { label: 'Ditolak',    color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: XCircle },
  FULFILLED:       { label: 'Pesanan Terpenuhi Penuh', color: 'text-stone-700', bg: 'bg-stone-100 border-stone-200', icon: Truck },
};

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [po, setPo] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const supabase = createClient();
  const [selectedApprover, setSelectedApprover] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Receiving state
  const [receivedQty, setReceivedQty] = useState(0);
  const [sessionScanned, setSessionScanned] = useState(0);
  const [receiving, setReceiving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");

  const load = async () => {
    try {
      const [poRes, usersRes, meRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, products:product_id (id, code, name, unit), requester:requester_id (name), approver:approver_id (name)').eq('id', id).single(),
        supabase.from('users').select('*'),
        supabase.auth.getUser()
      ]);
      
      if (poRes.data) {
        setPo(poRes.data);
        // Calculate already received qty via reference
        const txRes = await supabase.from('stock_transactions').select('quantity').eq('reference', poRes.data.po_number);
        const totalRcv = txRes.data?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
        setReceivedQty(totalRcv);
      }

      if (usersRes.data) setUsers(usersRes.data);
      
      if (meRes.data?.user) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', meRes.data.user.id).single();
        if (profile) setCurrentUser(profile);
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal memuat data PO.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // Keep focus on hidden input for PO scanner
  useEffect(() => {
    if (po?.status === 'APPROVED') {
      const focusInterval = setInterval(() => {
        if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.id !== 'manual-code-input') {
          inputRef.current?.focus();
        }
      }, 1000);
      return () => clearInterval(focusInterval);
    }
  }, [po?.status]);

  const playBeep = () => {
    try {
      const audioContent = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
      audioContent.volume = 0.5;
      audioContent.play().catch(() => {});
    } catch(e) {}
  };

  const handleBarcodeSubmit = (code: string) => {
    if (!code.trim() || !po) return;
    if (code === po.products.code) {
      // Valid item scanned!
      const totalSessionNext = sessionScanned + 1;
      const totalAll = receivedQty + totalSessionNext;
      
      if (totalAll > po.quantity) {
        toast.error("Melebihi target batas pesanan PO!");
        playBeep();
      } else {
        setSessionScanned(totalSessionNext);
        playBeep();
      }
    } else {
      toast.error(`Barcode salah! Pesanan ini khusus untuk barang: ${po.products.code}`);
    }
  };

  const submitReceiving = async () => {
    if (sessionScanned <= 0) return;
    setReceiving(true);

    try {
      // 1. Submit stock transaction IN pointing to PO number
      const batchRes = await fetch('/api/stock/update-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: [{ product_id: po.products.id, quantity: sessionScanned }],
          type: "IN",
          notes: `Penerimaan inbound dari ${po.po_number}`,
          reference: po.po_number
        })
      });

      const batchResult = await batchRes.json();
      if (!batchRes.ok) throw new Error(batchResult.error);

      const totalArrivedNow = receivedQty + sessionScanned;
      
      // 2. Check complete fulfillment completion
      if (totalArrivedNow >= po.quantity) {
        // Mark PO as FULFILLED completely
        const fulfillRes = await fetch('/api/purchasing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: po.id, status: 'FULFILLED', approver_id: po.approver_id })
        });
        if (!fulfillRes.ok) throw new Error("Gagal mengupdate final status PO");
        toast.success("PO Terpenuhi Penuh!");
      } else {
        toast.success(`Penerimaan Parsial Vavlid. Sisa: ${po.quantity - totalArrivedNow} unit.`);
      }

      // Reset and reload
      setSessionScanned(0);
      await load();
      router.refresh();

    } catch (e: any) {
      toast.error(e.message || "Kesalahan proses penerimaan");
    } finally {
      setReceiving(false);
    }
  };

  const handleAction = async (action: "APPROVED" | "REJECTED") => {
    if (!selectedApprover) {
      toast.warning("Pilih nama approver terlebih dahulu.");
      return;
    }
    setApproving(true);
    const res = await fetch('/api/purchasing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: po.id,
        status: action,
        approver_id: selectedApprover || po.approver_id
      })
    });
    const result = await res.json();
    setApproving(false);
    if (!res.ok) {
      toast.error("Gagal mengubah status: " + result.error);
    } else {
      toast.success(action === 'APPROVED' ? "✅ PO berhasil disetujui!" : "❌ PO berhasil ditolak.");
      await load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!po) return <div className="text-center py-20">Purchase Order tidak ditemukan.</div>;

  const cfg = statusConfig[po.status] || statusConfig['PENDING_MANAGER'];
  const StatusIcon = cfg.icon;
  const canApprove = po.status === 'PENDING_MANAGER' || po.status === 'PENDING_OWNER';
  const isActiveReceiving = po.status === 'APPROVED';

  // Target sisa pesanan
  const remainingTarget = po.quantity - receivedQty;
  const targetCompleted = remainingTarget <= 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Hidden Global Input trap for barcode gun */}
      {isActiveReceiving && (
        <input 
          ref={inputRef}
          type="text" 
          className="opacity-0 absolute w-0 h-0" 
          value={barcodeBuffer}
          onChange={e => setBarcodeBuffer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleBarcodeSubmit(barcodeBuffer);
              setBarcodeBuffer("");
            }
          }}
          autoFocus
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Detail Purchase Order</h2>
          <p className="text-sm font-mono font-bold text-stone-400 mt-0.5">{po.po_number}</p>
        </div>
      </div>

      <div className={`rounded-xl border-l-[6px] p-5 flex items-center justify-between ${cfg.bg} ${cfg.color.replace('text-', 'border-')}`}>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-white/80 shadow-sm">
            <StatusIcon className={`h-6 w-6 ${cfg.color}`} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Status Saat Ini</p>
            <p className={`text-xl font-black ${cfg.color}`}>{cfg.label}</p>
          </div>
        </div>
        {isActiveReceiving && (
           <div className="text-right">
             <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Total Tiba / Diterima</p>
             <p className="text-2xl font-black text-emerald-700">{receivedQty} <span className="text-sm">/ {po.quantity} {po.products?.unit}</span></p>
           </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PO Info */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            Informasi Produk
          </h3>
          <div className="space-y-3">
            <InfoRow label="Nama Produk" value={po.products?.name || '—'} highlight/>
            <InfoRow label="Kode Barcode Target" value={po.products?.code || '—'} />
            <InfoRow label="Satuan" value={po.products?.unit || '—'} />
            <InfoRow label="Total Sasaran Pesan" value={`${po.quantity} ${po.products?.unit || ''}`} />
            <InfoRow label="Harga Total Keseluruhan" value={po.total_price ? `Rp ${po.total_price.toLocaleString('id-ID')}` : '—'} />
          </div>
        </div>

        {/* PO Meta */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-stone-800">Informasi Request</h3>
          <div className="space-y-3">
            <InfoRow label="Pemohon" value={po.requester?.name || '—'} />
            <InfoRow label="Penyetuju" value={po.approver?.name || 'Belum ada'} />
            <InfoRow label="Tanggal Dibuat" value={new Date(po.created_at).toLocaleString('id-ID')} />
            {po.approved_at && <InfoRow label="Tanggal Disetujui" value={new Date(po.approved_at).toLocaleString('id-ID')} />}
          </div>
        </div>
      </div>

      {/* Approval Actions */}
      {canApprove && (currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER') && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-800 mb-4">Tindakan Approval</h3>
          <div className="mb-4 space-y-2">
            <label className="text-sm font-bold text-stone-700">Petugas yang Menyetujui</label>
            <select
              value={selectedApprover}
              onChange={e => setSelectedApprover(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50"
            >
              <option value="" disabled>-- Pilih Approver --</option>
              {users.filter(u => u.role === 'MANAGER' || u.role === 'OWNER').map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => handleAction('APPROVED')} disabled={approving} className="flex-1 h-12 font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md">
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Setujui PO
            </Button>
            <Button onClick={() => handleAction('REJECTED')} disabled={approving} className="flex-1 h-12 font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-md">
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />} Tolak PO
            </Button>
          </div>
        </div>
      )}

      {/* RECEIVING SECTOR: Barcode Validation */}
      {isActiveReceiving && !targetCompleted && (
        <div className="rounded-3xl border-2 border-emerald-500 overflow-hidden shadow-2xl bg-white mt-8">
          <div className="bg-emerald-500 p-4 text-white text-center">
            <h3 className="font-black text-xl flex items-center justify-center gap-2">
              <ScanBarcode className="w-6 h-6" /> Proses Inbound Barcode Integrasi
            </h3>
            <p className="text-emerald-100 text-sm mt-1">Staf gudang: Siapkan stiker barcode sejumlah barang yang datang.</p>
          </div>
          
          <div className="p-6 md:p-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8 items-center bg-stone-50 rounded-2xl p-6 border border-stone-100">
               <div className="space-y-4">
                 <h4 className="font-bold text-stone-800">1. Cetak Label Khusus PO ini</h4>
                 <p className="text-sm text-stone-500 leading-relaxed">Sebelum di-*scan*, pastikan setiap kaleng/barang sudah tertempel stiker <b>{po.products.code}</b>.</p>
                 <Button 
                   onClick={() => router.push(`/stock/${po.products.id}/print?copies=${remainingTarget}`)}
                   className="w-full bg-stone-800 hover:bg-black text-white h-12 rounded-xl"
                 >
                   <Printer className="w-4 h-4 mr-2" /> Cetak {remainingTarget} Stiker Label
                 </Button>
               </div>
               
               <div className="h-full flex flex-col justify-center border-l-2 border-stone-200 border-dashed pl-8">
                 <h4 className="font-bold text-stone-800 mb-4">2. Pemindai Valdiator Barang</h4>
                 <div className="bg-stone-900 rounded-xl overflow-hidden relative border border-stone-800 shadow-inner">
                    <BarcodeScanner onScanSuccess={handleBarcodeSubmit} />
                    <div className="bg-stone-800/80 backdrop-blur-sm p-3">
                      <Input 
                        id="manual-code-input"
                        placeholder="Bypass Barcode... (Demo Saja)"
                        className="bg-black border-stone-700 text-emerald-400 font-mono text-center h-10"
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
            </div>

            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 text-center relative overflow-hidden">
               <p className="text-emerald-800 font-bold mb-2">Progress Pemindaian Sesi Ini</p>
               <div className="flex justify-center items-end gap-3 mb-4">
                 <span className="text-6xl font-black text-emerald-600 leading-none">{sessionScanned}</span>
                 <span className="text-xl font-bold text-emerald-400 mb-1">/ {remainingTarget} unit target {po.products.name}</span>
               </div>
               
               <Button 
                  onClick={submitReceiving}
                  disabled={sessionScanned === 0 || receiving}
                  className="h-14 px-10 text-lg font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/30 rounded-xl"
               >
                 {receiving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                 Simpan & Validasi {sessionScanned} Barang Masuk
               </Button>
               <p className="text-xs text-emerald-600 font-bold mt-4">
                 Anda bisa menyimpan sebagian (Parsial) jika suplier tidak bawa *full* hari ini.
               </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-stone-50">
      <span className="text-sm text-stone-500 font-medium">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-amber-600 text-base' : 'text-stone-800'}`}>{value}</span>
    </div>
  );
}
