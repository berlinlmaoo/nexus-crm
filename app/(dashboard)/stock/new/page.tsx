import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/stock/ProductForm";
import { getProductOptions } from "@/lib/product-options";

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const { categories, units, nextCode } = await getProductOptions();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/stock">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Tambah Barang</h2>
          <p className="text-sm text-stone-500 mt-1">Daftarin bahan baku atau barang baru ke gudang.</p>
        </div>
      </div>

      <ProductForm categories={categories} units={units} suggestedCode={nextCode} />
    </div>
  );
}
