"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Truck, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  PENDING_MANAGER: { label: 'Menunggu Persetujuan Manager', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  PENDING_OWNER:   { label: 'Menunggu Persetujuan Owner',   color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: Clock },
  APPROVED:        { label: 'Disetujui',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  REJECTED:        { label: 'Ditolak',    color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: XCircle },
  FULFILLED:       { label: 'Terpenuhi', color: 'text-stone-700', bg: 'bg-stone-100 border-stone-200', icon: Truck },
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

  useEffect(() => {
    async function load() {
      try {
        const [poRes, usersRes, meRes] = await Promise.all([
          supabase.from('purchase_orders').select('*, products(name, unit), requester(name), approver(name)').eq('id', id).single(),
          supabase.from('users').select('*'),
          supabase.auth.getUser()
        ]);
        
        if (poRes.data) setPo(poRes.data);
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
    }
    load();
  }, [id]);

  const handleAction = async (action: "APPROVED" | "REJECTED" | "FULFILLED") => {
    if (!selectedApprover && action !== "FULFILLED") {
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
      setPo(result.data);
      const labels: Record<string, string> = {
        APPROVED: "✅ PO berhasil disetujui!",
        REJECTED: "❌ PO berhasil ditolak.",
        FULFILLED: "🚚 PO ditandai sebagai Terpenuhi!"
      };
      toast.success(labels[action] || "Status berhasil diperbarui.");
      setTimeout(() => router.push('/purchasing'), 1500);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500 font-medium">Purchase Order tidak ditemukan.</p>
        <Button onClick={() => router.back()} className="mt-4">Kembali</Button>
      </div>
    );
  }

  const cfg = statusConfig[po.status] || statusConfig['PENDING_MANAGER'];
  const StatusIcon = cfg.icon;
  const canApprove = po.status === 'PENDING_MANAGER' || po.status === 'PENDING_OWNER';
  const canFulfill = po.status === 'APPROVED';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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

      {/* Status Banner */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${cfg.bg}`}>
        <div className={`p-3 rounded-full bg-white/80`}>
          <StatusIcon className={`h-6 w-6 ${cfg.color}`} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Status Saat Ini</p>
          <p className={`text-xl font-black ${cfg.color}`}>{cfg.label}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PO Info */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            Informasi Produk
          </h3>
          <div className="space-y-3">
            <InfoRow label="Nama Produk" value={po.products?.name || '—'} />
            <InfoRow label="Satuan" value={po.products?.unit || '—'} />
            <InfoRow label="Jumlah (Qty)" value={`${po.quantity} ${po.products?.unit || ''}`} highlight />
            <InfoRow label="Harga Satuan" value={po.unit_price ? `Rp ${po.unit_price.toLocaleString('id-ID')}` : '—'} />
            <InfoRow label="Total Harga" value={po.total_price ? `Rp ${po.total_price.toLocaleString('id-ID')}` : '—'} highlight />
          </div>
        </div>

        {/* PO Meta */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-stone-800">Informasi Request</h3>
          <div className="space-y-3">
            <InfoRow label="Pemohon" value={po.requester?.name || '—'} />
            <InfoRow label="Approver" value={po.approver?.name || 'Belum ada'} />
            <InfoRow label="Tanggal Dibuat" value={new Date(po.created_at).toLocaleString('id-ID')} />
            {po.approved_at && <InfoRow label="Tanggal Disetujui" value={new Date(po.approved_at).toLocaleString('id-ID')} />}
          </div>
          {po.notes && (
            <div className="mt-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">Catatan</p>
              <p className="text-stone-700 text-sm">{po.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Approval Actions */}
      {(canApprove || canFulfill) && (currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER') && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-800 mb-4">Tindakan Approval</h3>
          
          {canApprove && (
            <div className="mb-4 space-y-2">
              <label className="text-sm font-bold text-stone-700">Petugas yang Menyetujui</label>
              <select
                value={selectedApprover}
                onChange={e => setSelectedApprover(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium text-stone-800 outline-none"
              >
                <option value="" disabled>-- Pilih Approver --</option>
                {users.filter(u => u.role === 'MANAGER' || u.role === 'OWNER').map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            {canApprove && (
              <>
                <Button
                  onClick={() => handleAction('APPROVED')}
                  disabled={approving}
                  className="flex-1 h-12 font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                >
                  {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Setujui PO
                </Button>
                <Button
                  onClick={() => handleAction('REJECTED')}
                  disabled={approving}
                  className="flex-1 h-12 font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20"
                >
                  {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Tolak PO
                </Button>
              </>
            )}
            {canFulfill && (
              <Button
                onClick={() => handleAction('FULFILLED')}
                disabled={approving}
                className="flex-1 h-12 font-bold bg-sky-500 hover:bg-sky-600 text-white"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                Tandai Terpenuhi
              </Button>
            )}
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
