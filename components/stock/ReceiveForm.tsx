"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, PackagePlus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { segarkanData } from "@/app/actions";

type Pilihan = { id: string; code: string; name: string; unit: string };
type PO = { id: string; po_number: string; quantity: number; product_id: string; sisa: number };

/**
 * Barang datang: pilih barangnya, isi berapa banyak, sistem yang bikin nomor serinya.
 *
 * Ini form, bukan halaman scan — dan itu disengaja. Waktu barang baru dateng stikernya belum
 * ada, jadi nggak ada yang bisa discan. Yang terjadi di sini justru kebalikannya: stikernya
 * dilahirkan di sini, lalu langsung dibawa ke halaman cetak.
 */
export function ReceiveForm({ products, purchaseOrders }: { products: Pilihan[]; purchaseOrders: PO[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [poId, setPoId] = useState("");
  const [count, setCount] = useState(1);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const terpilih = products.find((p) => p.id === productId);
  // Cuma PO buat barang yang lagi dipilih. Nawarin PO barang lain cuma bikin salah pilih,
  // dan server juga bakal nolaknya.
  const poBarangIni = purchaseOrders.filter((p) => p.product_id === productId);
  const poTerpilih = poBarangIni.find((p) => p.id === poId);

  // Ganti barang = PO lamanya nggak nyambung lagi.
  const gantiBarang = (id: string) => {
    setProductId(id);
    setPoId("");
  };

  // Ambil PO = jumlahnya diisiin sisa PO-nya, karena itu yang paling sering bener.
  const ambilPo = (id: string) => {
    setPoId(id);
    const po = poBarangIni.find((p) => p.id === id);
    if (po) {
      setCount(po.sisa);
      setReference(po.po_number);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!productId) return toast.error("Pilih barangnya dulu");
    if (count < 1) return toast.error("Jumlah minimal 1");

    setSaving(true);
    try {
      const res = await fetch("/api/stock/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, count, reference: reference.trim() || null, po_id: poId || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal nyatet barang masuk");
        return;
      }

      const serials: string[] = json.data?.serials ?? [];
      toast.success(`${serials.length} nomor unit dibikin. Cetak stikernya, tempel, terus validasi di Terminal.`);
      await segarkanData(["/stock", "/purchasing", "/"]);
      // Langsung ke halaman cetak: stiker yang belum ditempel itu unit yang nggak bisa
      // dikeluarin nanti, jadi mencetak bukan langkah opsional yang bisa ditunda.
      router.push(`/stock/${productId}/print?serials=${encodeURIComponent(serials.join(","))}`);
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
          Daftarin barangnya dulu, baru bisa nyatet kedatangan dan nyetak stikernya.
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
            id="product" value={productId} onChange={(e) => gantiBarang(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 outline-none focus:border-amber-500 cursor-pointer"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} &middot; {p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="po">
            Dari PO <span className="normal-case font-medium text-stone-400">(opsional)</span>
          </label>
          <select
            id="po" value={poId} onChange={(e) => ambilPo(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-800 outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">— Tanpa PO (belanja langsung / nota) —</option>
            {poBarangIni.map((p) => (
              <option key={p.id} value={p.id}>{p.po_number} — sisa {p.sisa} unit</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-stone-400">
            {poBarangIni.length === 0
              ? "Nggak ada PO terbuka buat barang ini. Isi nomor nota di bawah kalau ada."
              : "Kalau dipilih, barang yang divalidasi otomatis ngurangin sisa PO dan nutup PO-nya kalau udah genap."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="count">Jumlah Unit</label>
            <Input
              id="count" inputMode="numeric" value={count === 0 ? "" : String(count)}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                setCount(Number.isFinite(n) ? n : 0);
              }}
              className="text-lg font-bold"
            />
            <p className="mt-1 text-[11px] text-stone-400">
              Tiap unit dapet nomor sendiri dan satu stiker. Maksimal 500 sekali terima.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="reference">Nomor Nota <span className="normal-case font-medium text-stone-400">(opsional)</span></label>
            <Input
              id="reference" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Nota toko / surat jalan" className="font-mono"
              readOnly={Boolean(poTerpilih)}
            />
            {poTerpilih && (
              <p className="mt-1 text-[11px] text-stone-400">Ngikutin nomor PO yang dipilih.</p>
            )}
          </div>
        </div>

        {terpilih && count > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Bakal dibikin <span className="font-black">{count}</span> nomor unit buat{" "}
            <span className="font-bold">{terpilih.name}</span>, masing-masing beda.
            <span className="mt-1 block">
              Stok <span className="font-bold">belum naik</span> di langkah ini — naiknya nanti pas
              stikernya ditempel dan ditembak di Terminal, mode Barang Masuk.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit" disabled={saving}
          className="h-12 px-8 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PackagePlus className="h-4 w-4 mr-2" />}
          Buat Nomor &amp; Cetak Stiker
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
          <Printer className="h-3.5 w-3.5" /> Langsung dibawa ke halaman cetak.
        </span>
        <Link href="/stock" className="ml-auto">
          <Button type="button" variant="ghost" className="h-12 font-bold text-stone-500">Batal</Button>
        </Link>
      </div>
    </form>
  );
}
