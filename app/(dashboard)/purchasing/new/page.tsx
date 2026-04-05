"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    unit_price: '',
    notes: '',
    requester_id: ''
  });

  useEffect(() => {
    // Load products and users in parallel for the form dropdowns
    async function load() {
      try {
        const [pRes, uRes] = await Promise.all([
          fetch('/api/purchasing/products'),
          fetch('/api/users')
        ]);
        const [pJson, uJson] = await Promise.all([pRes.json(), uRes.json()]);
        if (pJson.data) setProducts(pJson.data);
        if (uJson.data) setUsers(uJson.data);
      } catch (err) {
        console.error('Failed to load form data', err);
      }
    }
    load();
  }, []);

  const selectedProduct = products.find(p => p.id === form.product_id);
  const estimatedTotal = form.unit_price && form.quantity 
    ? Number(form.unit_price) * Number(form.quantity) 
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.quantity || !form.requester_id) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/purchasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: form.product_id,
          quantity: Number(form.quantity),
          unit_price: form.unit_price ? Number(form.unit_price) : null,
          notes: form.notes,
          requester_id: form.requester_id
        })
      });

      const result = await res.json();
      setLoading(false);

      if (!res.ok) {
        alert("Error: " + result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/purchasing');
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setLoading(false);
      alert("Network error: " + err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Buat Purchase Order Baru</h2>
          <p className="text-sm text-stone-500 mt-1">PO akan dikirim ke Manager untuk disetujui.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {success ? (
          <div className="p-16 text-center">
            <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-2xl font-black text-stone-800">PO Berhasil Dibuat!</h3>
            <p className="text-stone-500 mt-2">Mengarahkan ke daftar Purchase Orders...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Produk / Bahan</label>
              <select
                value={form.product_id}
                onChange={e => setForm(f => ({...f, product_id: e.target.value}))}
                className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium text-stone-800 outline-none"
                required
              >
                <option value="" disabled>-- Pilih Produk --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stok: {p.current_stock} {p.unit})</option>
                ))}
              </select>
              {selectedProduct && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">{selectedProduct.category}</Badge>
                  <Badge variant="secondary" className="bg-stone-100 text-stone-600">Stok: {selectedProduct.current_stock} {selectedProduct.unit}</Badge>
                  <Badge variant="secondary" className="bg-stone-100 text-stone-600">Harga: Rp {selectedProduct.price?.toLocaleString('id-ID')}</Badge>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-stone-700">Jumlah (Qty)</label>
                <Input 
                  type="number" min="1" required
                  value={form.quantity}
                  onChange={e => setForm(f => ({...f, quantity: e.target.value}))}
                  placeholder="0"
                  className="h-12 text-lg font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-stone-700">Harga Satuan (Opsional)</label>
                <Input 
                  type="number" min="0"
                  value={form.unit_price}
                  onChange={e => setForm(f => ({...f, unit_price: e.target.value}))}
                  placeholder="Rp 0"
                  className="h-12"
                />
              </div>
            </div>

            {estimatedTotal > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-800">Estimasi Total Harga</p>
                <p className="text-2xl font-black text-amber-600">Rp {estimatedTotal.toLocaleString('id-ID')}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Pemohon (Requester)</label>
              <select
                value={form.requester_id}
                onChange={e => setForm(f => ({...f, requester_id: e.target.value}))}
                className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-stone-50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium text-stone-800 outline-none"
                required
              >
                <option value="" disabled>-- Pilih Staff --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700">Catatan / Keterangan</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                placeholder="Alasan pembelian, referensi supplier, dsb..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium text-stone-800 outline-none resize-none"
              />
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <Button type="submit" disabled={loading} className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Membuat PO...' : 'Kirim Purchase Order'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
