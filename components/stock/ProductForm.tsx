"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Save, Trash2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { segarkanData } from "@/app/actions";

export type ProductFormValues = {
  id?: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  min_stock: number;
  current_stock: number;
  barcode: string | null;
  is_active: boolean;
};

/**
 * Form master barang, dipakai bareng halaman "Tambah Barang" dan "Edit Barang".
 *
 * Catatan yang bikin dua mode ini beda:
 * - **Stok awal cuma ada pas bikin baru.** Waktu edit, stok nggak bisa disentuh dari sini sama
 *   sekali — dia cuma gerak lewat transaksi di Terminal Scanner. Itu kebijakan yang udah dipegang
 *   aplikasi ini, dan kalau form edit bisa nyetel stok diam-diam, riwayatnya jadi bohong.
 * - **Tombol hapus cuma ada pas edit**, dan server yang mutusin boleh apa nggak (ditolak kalau
 *   barangnya udah punya riwayat).
 */
export function ProductForm({
  initial,
  categories,
  units,
  suggestedCode,
}: {
  initial?: ProductFormValues;
  categories: string[];
  units: string[];
  /** Kode urut berikutnya, buat ngisi form barang baru. Server tetap yang mutusin pas nyimpen. */
  suggestedCode?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [values, setValues] = useState<ProductFormValues>(
    initial ?? {
      code: suggestedCode ?? "", name: "", category: "", unit: "",
      price: 0, min_stock: 0, current_stock: 0,
      barcode: null, is_active: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof ProductFormValues>(key: K, v: ProductFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  /** Angka di input: kosong dibaca 0, dan bukan NaN yang bikin body JSON-nya invalid. */
  const num = (raw: string) => {
    const n = parseInt(raw.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const res = await fetch(isEdit ? `/api/products/${initial!.id}` : "/api/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Gagal nyimpen barang");
        return;
      }
      if (json.warning) toast.warning(json.warning);
      else toast.success(isEdit ? "Perubahan tersimpan" : `Barang "${values.name}" berhasil didaftarkan`);

      // Cache-nya dibuang DULU, baru pindah halaman. Kebalikannya (refresh lalu push) cuma
      // nyegerin halaman yang lagi dibuka, bukan yang bakal dituju.
      await segarkanData(["/stock", "/purchase-requests", initial?.id ? `/stock/${initial.id}` : ""]);
      router.push(isEdit ? `/stock/${initial!.id}` : "/stock");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Nggak bisa nyambung ke server");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial?.id || deleting) return;
    setDeleting(true);

    try {
      // Langsung hapus, tanpa dialog konfirmasi — permintaan Bagas. `force=1` dari awal, jadi
      // barang yang punya riwayat pun nggak ditanya dua kali.
      //
      // Konsekuensinya nyata dan disengaja: FK-nya ON DELETE CASCADE, jadi satu ketukan
      // ngehapus barangnya beserta seluruh transaksi stok, nomor unit, dan PO-nya, permanen.
      // Yang tersisa sebagai penjaga cuma satu: barang yang udah punya riwayat cuma bisa
      // dihapus OWNER (dicek di server).
      const res = await fetch(`/api/products/${initial.id}?force=1`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Gagal menghapus barang");
        return;
      }

      // Dikasih tahu SESUDAHNYA apa aja yang ikut hilang. Nggak nahan siapa pun, tapi kalau
      // ternyata salah barang, angkanya kelihatan saat itu juga.
      const r = json.terhapus ?? {};
      const ikut = [
        r.transaksi ? `${r.transaksi} transaksi` : null,
        r.unit ? `${r.unit} unit` : null,
        r.po ? `${r.po} PO` : null,
      ].filter(Boolean).join(", ");

      toast.success(ikut ? `"${initial.name}" dihapus — ${ikut} ikut terhapus` : `"${initial.name}" dihapus`);
      await segarkanData(["/stock", "/purchase-requests", "/purchasing", "/"]);
      router.push("/stock");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Nggak bisa nyambung ke server");
    } finally {
      setDeleting(false);
    }
  };

  const label = "block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        <h3 className="font-black text-stone-900">Identitas Barang</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="code">Kode Barang</label>
            <Input
              id="code" required value={values.code} maxLength={20}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="BB-001"
              className="font-mono font-bold"
            />
            <p className="mt-1 text-[11px] text-stone-400">
              {isEdit
                ? "Dipakai buat scan. Otomatis jadi huruf besar."
                : "Terisi otomatis dari urutan terakhir. Boleh diganti kalau perlu."}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="name">Nama Barang</label>
            <Input
              id="name" required autoFocus={!isEdit} value={values.name} maxLength={200}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Beras premium 10 kg"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="category">Kategori</label>
            <Input
              id="category" required list="kategori-barang" value={values.category} maxLength={50}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Bahan Baku"
            />
            <datalist id="kategori-barang">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className={label} htmlFor="unit">Satuan</label>
            <Input
              id="unit" required list="satuan-barang" value={values.unit} maxLength={20}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="gr / ml / pcs"
            />
            <datalist id="satuan-barang">
              {units.map((u) => <option key={u} value={u} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="barcode">Barcode <span className="normal-case font-medium text-stone-400">(opsional)</span></label>
          <Input
            id="barcode" value={values.barcode ?? ""} maxLength={20}
            onChange={(e) => set("barcode", e.target.value || null)}
            placeholder="Kosongin kalau barangnya discan pakai kode di atas"
            className="font-mono"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
        <h3 className="font-black text-stone-900">Harga &amp; Stok</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="price">Harga Satuan (Rp)</label>
            <Input
              id="price" inputMode="numeric" value={values.price === 0 ? "" : String(values.price)}
              onChange={(e) => set("price", num(e.target.value))}
              placeholder="0"
            />
          </div>
          <div>
            <label className={label} htmlFor="min_stock">Batas Minimum</label>
            <Input
              id="min_stock" inputMode="numeric" value={values.min_stock === 0 ? "" : String(values.min_stock)}
              onChange={(e) => set("min_stock", num(e.target.value))}
              placeholder="0"
            />
            <p className="mt-1 text-[11px] text-stone-400">Di bawah/sama dengan ini ditandai CRITICAL.</p>
          </div>

          {isEdit ? (
            <div>
              <label className={label}>Stok Saat Ini</label>
              <div className="flex h-10 items-center rounded-md border border-dashed border-stone-200 bg-stone-50 px-3 text-sm font-bold text-stone-500">
                {initial!.current_stock} {values.unit}
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                Cuma bisa berubah lewat <Link href="/stock/scan" className="font-bold text-amber-600 hover:underline">Terminal Scanner</Link>.
              </p>
            </div>
          ) : (
            <div>
              <label className={label} htmlFor="current_stock">Stok Awal</label>
              <Input
                id="current_stock" inputMode="numeric"
                value={values.current_stock === 0 ? "" : String(values.current_stock)}
                onChange={(e) => set("current_stock", num(e.target.value))}
                placeholder="0"
              />
              <p className="mt-1 text-[11px] text-stone-400">Dicatat sebagai opname, jadi ada jejaknya.</p>
            </div>
          )}
        </div>

        {isEdit && (
          <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 cursor-pointer">
            <input
              type="checkbox" checked={values.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <span className="text-sm">
              <span className="font-bold text-stone-800">Barang aktif</span>
              <span className="block text-stone-500">Kalau dimatiin, barangnya nggak dipakai lagi tapi riwayat stoknya tetap utuh.</span>
            </span>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit" disabled={saving}
          className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : isEdit ? <Save className="h-4 w-4 mr-2" /> : <PackagePlus className="h-4 w-4 mr-2" />}
          {isEdit ? "Simpan Perubahan" : "Daftarkan Barang"}
        </Button>

        <Link href={isEdit ? `/stock/${initial!.id}` : "/stock"}>
          <Button type="button" variant="ghost" className="h-12 font-bold text-stone-500">Batal</Button>
        </Link>

        {isEdit && (
          <Button
            type="button" variant="ghost" onClick={remove} disabled={deleting}
            className="h-12 ml-auto font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Hapus Barang
          </Button>
        )}
      </div>
    </form>
  );
}
