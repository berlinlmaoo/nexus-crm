import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
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

  const isCritical = product.current_stock <= product.min_stock;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/stock/scan">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Detail & Update Stok</h2>
          <p className="text-sm text-stone-500 mt-1">Review informasi master barang dan tambahkan riwayat stok.</p>
        </div>
        <Link href={`/stock/${product.id}/print`}>
          <Button variant="outline" className="font-bold border-amber-200 text-amber-600 hover:bg-amber-50">
            🖨️ Cetak Label Barcode
          </Button>
        </Link>
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
    </div>
  );
}
