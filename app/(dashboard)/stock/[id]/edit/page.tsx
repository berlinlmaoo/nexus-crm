import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/stock/ProductForm";
import { getProductOptions } from "@/lib/product-options";

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: product }, { categories, units }] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).single(),
    getProductOptions(),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/stock/${product.id}`}>
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Edit Barang</h2>
          <p className="text-sm text-stone-500 mt-1">{product.code} &middot; {product.name}</p>
        </div>
      </div>

      <ProductForm
        categories={categories}
        units={units}
        initial={{
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: product.price,
          min_stock: product.min_stock,
          current_stock: product.current_stock,
          barcode: product.barcode,
          is_active: product.is_active !== false,
        }}
      />
    </div>
  );
}
