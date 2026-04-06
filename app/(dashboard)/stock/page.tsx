import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Package, Search, Filter, ArrowUpRight, ArrowDownRight, AlertCircle, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StockSearch from '@/components/stock/StockSearch';
import StockFilter from '@/components/stock/StockFilter';

export default async function StockManagementPage(props: { searchParams?: Promise<{ q?: string; filter?: string }> }) {
  const searchParams = await props.searchParams;
  const query = searchParams?.q || "";
  const filterVal = searchParams?.filter || "ALL";

  const supabase = createClient();
  
  let supabaseQuery = supabase.from('products').select('*');

  if (query) {
    supabaseQuery = supabaseQuery.or(`code.ilike.%${query}%,name.ilike.%${query}%`);
  }

  const { data: rawProducts, error } = await supabaseQuery.order('code', { ascending: true });
  
  let products = rawProducts || [];
  
  if (filterVal === "CRITICAL") {
    products = products.filter(p => p.current_stock <= p.min_stock);
  } else if (filterVal === "SAFE") {
    products = products.filter(p => p.current_stock > p.min_stock);
  }

  if (error) {
    console.error("Fetch error:", error);
  }

  // Calculate some simple aggregates
  const totalItems = products?.length || 0;
  const criticalItems = products?.filter(p => p.current_stock <= p.min_stock).length || 0;
  const totalValue = products?.reduce((sum, p) => sum + (p.price * p.current_stock), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Manajemen Stok</h2>
          <p className="text-stone-500 mt-1">Pantau pergerakan bahan baku dan persediaan barang Anda.</p>
        </div>
        <div className="flex gap-2">
          <StockFilter currentFilter={filterVal} />
          <Link href="/stock/scan">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md shadow-amber-500/20">
              <ScanBarcode className="h-4 w-4 mr-2" />
              Terminal Scanner / Transaksi
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-sky-100 p-2 rounded-lg">
              <Package className="h-5 w-5 text-sky-600" />
            </div>
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Total Produk</h3>
          </div>
          <span className="text-3xl font-black text-stone-800">{totalItems}</span>
        </div>
        
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-rose-100 p-2 rounded-lg">
              <AlertCircle className="h-5 w-5 text-rose-600" />
            </div>
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Stok Kritis</h3>
          </div>
          <span className="text-3xl font-black text-rose-600">{criticalItems}</span>
          <span className="text-stone-400 text-sm ml-2 font-medium">butuh restock</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Nilai Aset</h3>
          </div>
          <span className="text-3xl font-black text-emerald-600">
            Rp {totalValue.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <StockSearch defaultQuery={query} />
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px] font-bold text-stone-600">Kode</TableHead>
                <TableHead className="font-bold text-stone-600">Nama Barang</TableHead>
                <TableHead className="font-bold text-stone-600">Kategori</TableHead>
                <TableHead className="text-right font-bold text-stone-600">Stok Saat Ini</TableHead>
                <TableHead className="text-right font-bold text-stone-600">Harga Satuan</TableHead>
                <TableHead className="text-center font-bold text-stone-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => {
                const isCritical = product.current_stock <= product.min_stock;
                
                return (
                  <TableRow key={product.id} className="hover:bg-stone-50/50 transition-colors">
                    <TableCell className="font-medium text-stone-500">{product.code}</TableCell>
                    <TableCell className="font-bold text-stone-800">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-200">
                        {product.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-end justify-end gap-1">
                        <span className={isCritical ? "text-rose-600 font-bold text-lg" : "font-bold text-lg"}>
                          {product.current_stock}
                        </span>
                        <span className="text-xs text-stone-400 mb-1">{product.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-stone-600">
                      Rp {product.price.toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={isCritical ? "destructive" : "outline"} 
                        className={isCritical 
                          ? "bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800 border-transparent shadow-none" 
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {isCritical ? "CRITICAL" : "SAFE"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {(!products || products.length === 0) && (
            <div className="py-12 text-center text-stone-500">
              Tidak ada data produk ditemukan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
