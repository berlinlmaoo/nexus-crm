"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { segarkanData } from "@/app/actions";

type Barang = {
  id: string; code: string; name: string; unit: string;
  current_stock: number; min_stock: number; price: number;
};

/**
 * Form pengajuan dari satu head.
 *
 * Stok yang lagi ada ditampilin di sebelah barangnya, dan itu bukan hiasan: pengajuan yang
 * dibikin tanpa lihat stok adalah cara paling gampang mesen barang yang sebenernya masih
 * numpuk di gudang.
 */
export function RequestForm({ products }: { products: Barang[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [harga, setHarga] = useState<number | "">("");
  const [urgent, setUrgent] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const barang = products.find((p) => p.id === productId);
  const kritis = barang && barang.current_stock <= barang.min_stock;

  const angka = (raw: string) => {
    const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!productId) return toast.error("Pilih barangnya dulu");
    if (quantity < 1) return toast.error("Jumlah minimal 1");

    setSaving(true);
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          quantity,
          estimated_price: harga === "" ? null : harga,
          urgency: urgent ? "URGENT" : "NORMAL",
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal ngirim request");
        return;
      }
      toast.success(`${json.data?.request_number ?? "Request"} terkirim. Nunggu diputusin Manager/Owner.`);
      await segarkanData(["/purchase-requests"]);
      router.push("/purchase-requests");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Nggak bisa nyambung ke server");
    } finally {
      setSaving(false);
    }
  };

  const label = "block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5";

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
        <h3 className="text-lg font-black text-stone-900">Belum ada barang yang terdaftar</h3>
        <p className="mx-auto mt-2 max-w-sm text-stone-500">
          Request nunjuk ke barang yang udah ada di daftar. Daftarin barangnya dulu di Manajemen Stok.
        </p>
        <Link href="/stock/new" className="mt-5 inline-block">
          <Button className="h-11 px-6 font-bold bg-amber-500 hover:bg-amber-600 text-white">Tambah Barang</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className={label} htmlFor="product">Barang</label>
          <select
            id="product" value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 outline-none focus:border-amber-500 cursor-pointer"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} &middot; {p.name}</option>
            ))}
          </select>

          {barang && (
            <div className={cn(
              "mt-2 rounded-xl px-4 py-3 text-sm",
              kritis ? "bg-rose-50 text-rose-900 border border-rose-200" : "bg-stone-50 text-stone-600 border border-stone-200"
            )}>
              {kritis && <AlertTriangle className="mr-1.5 inline h-4 w-4" />}
              Stok sekarang <span className="font-black">{barang.current_stock}</span> {barang.unit}
              {/* Warnanya ngikutin rona kotaknya, bukan abu-abu: abu-abu di atas latar berwarna
                  kebaca pudar. */}
              <span className={kritis ? "text-rose-700" : "text-stone-500"}> &middot; batas minimum {barang.min_stock}</span>
              {kritis && <span className="font-bold"> — udah di bawah batas.</span>}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="qty">Jumlah yang Diminta</label>
            <Input
              id="qty" inputMode="numeric" value={quantity === 0 ? "" : String(quantity)}
              onChange={(e) => setQuantity(angka(e.target.value))}
              className="text-lg font-bold"
            />
            {barang && <p className="mt-1 text-[11px] text-stone-400">Satuan: {barang.unit}</p>}
          </div>
          <div>
            <label className={label} htmlFor="harga">
              Perkiraan Harga Satuan <span className="normal-case font-medium text-stone-400">(opsional)</span>
            </label>
            <Input
              id="harga" inputMode="numeric" value={harga === "" ? "" : String(harga)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setHarga(v === "" ? "" : angka(v));
              }}
              placeholder={barang?.price ? String(barang.price) : "0"}
            />
            <p className="mt-1 text-[11px] text-stone-400">Dipakai buat ngira-ngira total PO.</p>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 cursor-pointer">
          <input
            type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)}
            className="h-4 w-4 accent-rose-500"
          />
          <span className="text-sm">
            <span className="font-bold text-stone-800">Mendesak</span>
            <span className="block text-stone-500">Ditandai merah di papan biar kelihatan duluan.</span>
          </span>
        </label>

        <div>
          <label className={label} htmlFor="notes">Alasan / Catatan <span className="normal-case font-medium text-stone-400">(opsional)</span></label>
          <textarea
            id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Buat acara sabtu, stok tinggal 2 hari, dll."
            className="w-full text-sm p-3 rounded-xl border border-stone-200 bg-stone-50 outline-none focus:border-amber-500 resize-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit" disabled={saving}
          className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Kirim Request
        </Button>
        <Link href="/purchase-requests">
          <Button type="button" variant="ghost" className="h-12 font-bold text-stone-500">Batal</Button>
        </Link>
      </div>
    </form>
  );
}
