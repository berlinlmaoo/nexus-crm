import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Pencil, ArrowDownLeft, ArrowUpRight, AlertTriangle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StockUpdateForm } from "@/components/stock/StockUpdateForm";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !product) {
    notFound();
  }

  // Riwayat pergerakan stok barang ini. Sampai sekarang halaman ini nggak nampilin apa pun
  // soal ini — `user_id` udah lama kecatat di tiap transaksi, tapi nggak pernah kelihatan di
  // mana-mana. Pertanggungjawaban yang nggak bisa dilihat siapa-siapa itu sama aja nggak ada.
  const [{ data: riwayat }, { data: unitList }] = await Promise.all([
    supabase
      .from("stock_transactions")
      .select("id, type, quantity, stock_before, stock_after, notes, reference, created_at, pelaku:user_id (name)")
      .eq("product_id", params.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("stock_units").select("status").eq("product_id", params.id),
  ]);

  const unit = { IN_STOCK: 0, PENDING: 0, USED: 0, WASTED: 0 } as Record<string, number>;
  (unitList || []).forEach((u: any) => { unit[u.status] = (unit[u.status] || 0) + 1; });

  const isCritical = product.current_stock <= product.min_stock;

  const GAYA: Record<string, { label: string; kelas: string; icon: any; tanda: string }> = {
    IN:         { label: "Masuk",     kelas: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ArrowDownLeft, tanda: "+" },
    OUT:        { label: "Keluar",    kelas: "bg-amber-50 text-amber-700 border-amber-200",       icon: ArrowUpRight,  tanda: "−" },
    WASTE:      { label: "Rusak",     kelas: "bg-rose-50 text-rose-700 border-rose-200",          icon: AlertTriangle, tanda: "−" },
    OPNAME:     { label: "Opname",    kelas: "bg-sky-50 text-sky-700 border-sky-200",             icon: ClipboardList, tanda: "=" },
    ADJUSTMENT: { label: "Penyesuaian", kelas: "bg-sky-50 text-sky-700 border-sky-200",           icon: ClipboardList, tanda: "=" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Di HP tombolnya turun ke barisnya sendiri. Sebelumnya semuanya dipaksa satu baris tanpa
          wrap, dan karena tombol nggak mau menyusut, judulnya yang kegencet sampai kepotong satu
          kata per baris. */}
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center sm:gap-4">
        <Link href="/stock" className="shrink-0">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">Detail &amp; Update Stok</h2>
          <p className="text-sm text-stone-500 mt-1">Review informasi master barang dan tambahkan riwayat stok.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
        <Link href={`/stock/${product.id}/edit`} className="flex-1 sm:flex-none">
          <Button variant="outline" className="w-full font-bold border-stone-300 text-stone-700 hover:bg-stone-50">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Barang
          </Button>
        </Link>
        <Link href={`/stock/${product.id}/print`} className="flex-1 sm:flex-none">
          <Button variant="outline" className="w-full font-bold border-amber-200 text-amber-600 hover:bg-amber-50">
            🖨️ <span className="ml-1.5">Cetak Stiker</span>
          </Button>
        </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border border-stone-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-4">
            <Package className="h-10 w-10 text-stone-400" />
          </div>
          <h3 className="text-xl font-black text-stone-900 leading-tight">{product.name}</h3>
          <p className="text-stone-400 font-bold tracking-widest text-xs mt-2 uppercase">{product.code}</p>
          
          <div className="w-full mt-6 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-stone-100">
              <span className="text-stone-500 text-sm">Kategori</span>
              <span className="font-bold text-stone-800 text-sm">{product.category}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100">
              <span className="text-stone-500 text-sm">Satuan</span>
              <span className="font-bold text-stone-800 text-sm">{product.unit}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100">
              <span className="text-stone-500 text-sm">Harga Standar</span>
              <span className="font-bold text-stone-800 text-sm">Rp {product.price.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border text-center border-stone-200 p-6 rounded-2xl shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Stok Saat Ini</p>
              <p className={`text-4xl font-black ${isCritical ? 'text-rose-600' : 'text-emerald-600'}`}>
                {product.current_stock} <span className="text-sm font-bold text-stone-400">{product.unit}</span>
              </p>
            </div>
            <div className="bg-white border text-center border-stone-200 p-6 rounded-2xl shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Batas Minimum</p>
              <p className="text-4xl font-black text-stone-800">
                {product.min_stock} <span className="text-sm font-bold text-stone-400">{product.unit}</span>
              </p>
            </div>
          </div>

          <StockUpdateForm product={product} />

        </div>
      </div>

      {/* Ringkasan unit fisik. Angka stok doang nggak cukup sejak barang dilacak per unit:
          "5 pcs" nggak ngasih tahu ada berapa yang stikernya belum ditempel. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Di gudang", n: unit.IN_STOCK, kelas: "text-emerald-700" },
          { label: "Nunggu validasi", n: unit.PENDING, kelas: unit.PENDING > 0 ? "text-amber-700" : "text-stone-500" },
          { label: "Udah keluar", n: unit.USED, kelas: "text-stone-500" },
          { label: "Dibuang", n: unit.WASTED, kelas: unit.WASTED > 0 ? "text-rose-700" : "text-stone-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-wider text-stone-600">{k.label}</p>
            <p className={`mt-1 text-2xl font-black leading-none ${k.kelas}`}>{k.n}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50/50 px-5 py-4">
          <h3 className="font-black text-stone-900">Riwayat Keluar &amp; Masuk</h3>
          <p className="text-xs text-stone-500">{(riwayat || []).length} pergerakan terakhir</p>
        </div>

        {(riwayat || []).length === 0 ? (
          <p className="px-5 py-12 text-center text-stone-500">
            Belum ada pergerakan stok buat barang ini.
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {(riwayat || []).map((t: any) => {
              const g = GAYA[t.type] || GAYA.ADJUSTMENT;
              const Ikon = g.icon;
              return (
                <div key={t.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-black uppercase tracking-wider ${g.kelas}`}>
                    <Ikon className="h-3 w-3" />
                    {g.label}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-stone-900">
                      {g.tanda}{t.quantity} <span className="text-xs font-medium text-stone-500">{product.unit}</span>
                      {/* Stok sebelum→sesudah dicetak apa adanya dari kolomnya, bukan dihitung
                          ulang di sini — kalau ada yang pernah nyentuh angka stok di luar jalur
                          transaksi, selisihnya kelihatan di sini, bukan ketutupan. */}
                      <span className="ml-2 text-xs font-medium text-stone-400">
                        {t.stock_before} → {t.stock_after}
                      </span>
                    </p>
                    {t.notes && <p className="mt-0.5 text-xs text-stone-500">{t.notes}</p>}
                    <p className="mt-0.5 text-[11px] text-stone-400">
                      {t.pelaku?.name ?? "akun terhapus"}
                      {t.reference ? ` · ${t.reference}` : ""}
                    </p>
                  </div>

                  <p className="shrink-0 text-[11px] text-stone-400 tabular-nums">
                    {new Date(t.created_at).toLocaleString("id-ID", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
