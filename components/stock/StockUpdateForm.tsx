"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CopyPlus, CopyMinus, Trash2, PenLine, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// We removed direct supabase imports because we will use a secure API Route.

export function StockUpdateForm({ product }: { product: any }) {
  const router = useRouter();
  const [type, setType] = useState<"IN" | "OUT" | "WASTE" | "ADJUSTMENT">("IN");
  const [qty, setQty] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || Number(qty) <= 0) return;

    setLoading(true);
    
    try {
      const response = await fetch('/api/stock/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product.id,
          type: type,
          quantity: Number(qty),
          notes: notes || `Direct ${type} update`
        })
      });

      const result = await response.json();

      setLoading(false);

      if (!response.ok) {
        alert("Error updating stock: " + (result.error || 'Unknown error'));
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/stock"); // Return to stock list after success
          router.refresh(); // Force reload data
        }, 1500);
      }
    } catch (e: any) {
      setLoading(false);
      alert("Error network: " + e.message);
    }
  };

  const types = [
    { id: "IN", label: "Masuk (IN)", icon: CopyPlus, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { id: "OUT", label: "Keluar (OUT)", icon: CopyMinus, color: "text-sky-600 bg-sky-50 border-sky-200" },
    { id: "WASTE", label: "Bocor/Rusak", icon: Trash2, color: "text-rose-600 bg-rose-50 border-rose-200" },
    { id: "ADJUSTMENT", label: "Opname/Ganti", icon: PenLine, color: "text-amber-600 bg-amber-50 border-amber-200" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-stone-100 bg-stone-50/50">
        <h3 className="font-bold text-stone-800">Form Pembaruan Stok</h3>
        <p className="text-sm text-stone-500">Pilih jenis pergerakan stok lalu masukkan jumlah qty yang benar.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {success ? (
          <div className="bg-emerald-50 text-emerald-700 p-6 rounded-xl border border-emerald-200 text-center font-bold text-lg">
            ✅ Pergerakan stok berhasil dicatat! Mengalihkan...
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className="text-sm font-bold text-stone-700">Jenis Pergerakan</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {types.map((t) => {
                  const isSelected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as any)}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all duration-200 ${
                        isSelected 
                          ? `ring-2 ring-offset-2 ${t.color.split(" ")[0].replace('text-', 'ring-')} ${t.color}` 
                          : "border-stone-200 bg-white hover:bg-stone-50 text-stone-500"
                      }`}
                    >
                      <t.icon className={`h-6 w-6 mb-2 ${isSelected ? "" : "text-stone-400"}`} />
                      <span className="text-xs font-bold">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-bold text-stone-700">Jumlah (Qty)</label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value ? Number(e.target.value) : "")}
                    placeholder="0"
                    className="h-12 text-lg font-bold text-stone-800"
                    required
                  />
                  <span className="text-stone-500 font-medium px-4">{product.unit}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-stone-700">Catatan / Referensi</label>
                <Input 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsional (Misal: PO-001, Rusak Kena Air...)"
                  className="h-12"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <Button type="submit" disabled={loading} className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Menyimpan..." : "Simpan Perubahan Stok"}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
