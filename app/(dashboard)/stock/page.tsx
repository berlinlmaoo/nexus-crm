import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Package, PackagePlus, ArrowUpRight, AlertCircle, ScanBarcode, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  // Unit yang nomornya udah dibikin tapi belum divalidasi masuk. Ini harus KELIHATAN — seluruh
  // gunanya validasi terpisah adalah supaya barang yang nggak pernah nyampe ketinggalan di sini,
  // bukan diam-diam kehitung jadi stok.
  const { data: pendingUnits } = await supabase
    .from('stock_units')
    .select('product_id')
    .eq('status', 'PENDING');
  const pendingPerBarang: Record<string, number> = {};
  (pendingUnits || []).forEach((u: any) => {
    pendingPerBarang[u.product_id] = (pendingPerBarang[u.product_id] || 0) + 1;
  });
  const totalPending = (pendingUnits || []).length;
  
  let products = rawProducts || [];

  // Barang nonaktif tetap ditampilin (biar jelas dia masih ada dan riwayatnya utuh), tapi nggak
  // ikut dihitung di ringkasan — barang yang udah nggak dipakai teriak CRITICAL itu cuma bikin
  // angka "butuh restock" nggak ada artinya.
  const isCritical = (p: any) => p.is_active !== false && p.current_stock <= p.min_stock;

  if (filterVal === "CRITICAL") {
    products = products.filter(isCritical);
  } else if (filterVal === "SAFE") {
    products = products.filter((p) => p.is_active !== false && p.current_stock > p.min_stock);
  }

  if (error) {
    console.error("Fetch error:", error);
  }

  // Calculate some simple aggregates
  const totalItems = products?.length || 0;
  const criticalItems = products?.filter(isCritical).length || 0;
  const totalValue = products
    ?.filter((p) => p.is_active !== false)
    .reduce((sum, p) => sum + (p.price * p.current_stock), 0) || 0;

  // Daftar kosong karena belum ada barang sama sekali itu keadaan yang beda banget dari daftar
  // kosong karena hasil pencarian nihil, dan dua-duanya butuh jalan keluar yang beda.
  const belumAdaBarangSamaSekali = totalItems === 0 && !query && filterVal === "ALL";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Manajemen Stok</h2>
          <p className="text-stone-500 mt-1">Pantau pergerakan bahan baku dan persediaan barang Anda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StockFilter currentFilter={filterVal} />
          <Link href="/stock/new">
            <Button variant="outline" className="font-bold border-stone-300 text-stone-700 hover:bg-stone-50">
              <PackagePlus className="h-4 w-4 mr-2" />
              Tambah Barang
            </Button>
          </Link>
          <Link href="/stock/receive">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20">
              <PackagePlus className="h-4 w-4 mr-2" />
              Barang Masuk
            </Button>
          </Link>
          {/* Cuma muncul kalau emang ada yang nunggu. Tombol yang selalu nongkrong dengan
              angka nol lama-lama nggak dilihat orang lagi. */}
          {totalPending > 0 && (
            <Link href="/stock/pending">
              <Button variant="outline" className="font-bold border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Nunggu Validasi
                <span className="ml-2 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {totalPending}
                </span>
              </Button>
            </Link>
          )}
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

      {totalPending > 0 && (
        <Link href="/stock/pending" className="block rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100">
          <p className="font-bold text-amber-900">
            {totalPending} unit nunggu divalidasi masuk
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Nomornya udah dibikin tapi stikernya belum ditembak di Terminal, jadi belum kehitung stok.
            Klik buat lihat kiriman mana yang ketinggalan &mdash; bisa cetak ulang stikernya dari sana.
          </p>
        </Link>
      )}

      {belumAdaBarangSamaSekali ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-stone-100">
            <Package className="h-7 w-7 text-stone-400" />
          </div>
          <h3 className="text-xl font-black text-stone-900">Gudang masih kosong</h3>
          <p className="mx-auto mt-2 max-w-md text-stone-500">
            Belum ada barang yang terdaftar. Daftarin bahan baku yang beneran dipakai dapur, terus
            stoknya digerakin lewat Terminal Scanner biar tiap perubahan ada jejaknya.
          </p>
          <Link href="/stock/new" className="mt-6 inline-block">
            <Button className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
              <PackagePlus className="h-4 w-4 mr-2" />
              Daftarkan Barang Pertama
            </Button>
          </Link>
        </div>
      ) : (
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
                <TableHead className="w-[52px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => {
                const critical = isCritical(product);
                const nonaktif = product.is_active === false;
                
                return (
                  <TableRow key={product.id} className={`hover:bg-stone-50/50 transition-colors ${nonaktif ? "opacity-60" : ""}`}>
                    <TableCell className="font-medium text-stone-500">{product.code}</TableCell>
                    <TableCell className="font-bold text-stone-800">
                      <Link href={`/stock/${product.id}`} className="hover:text-amber-600 hover:underline">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-200">
                        {product.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-end justify-end gap-1">
                        <span className={critical ? "text-rose-600 font-bold text-lg" : "font-bold text-lg"}>
                          {product.current_stock}
                        </span>
                        <span className="text-xs text-stone-400 mb-1">{product.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-stone-600">
                      Rp {product.price.toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">
                      {nonaktif ? (
                        <Badge variant="outline" className="bg-stone-100 text-stone-500 border-stone-200">
                          NONAKTIF
                        </Badge>
                      ) : pendingPerBarang[product.id] ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {pendingPerBarang[product.id]} NUNGGU VALIDASI
                        </Badge>
                      ) : (
                        <Badge 
                          variant={critical ? "destructive" : "outline"} 
                          className={critical 
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800 border-transparent shadow-none" 
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }
                        >
                          {critical ? "CRITICAL" : "SAFE"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/stock/${product.id}`} aria-label={`Buka detail ${product.name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {(!products || products.length === 0) && (
            <div className="py-12 text-center">
              <p className="text-stone-500">
                {query ? `Nggak ada barang yang cocok sama "${query}".` : "Nggak ada barang di filter ini."}
              </p>
              <Link href="/stock" className="mt-2 inline-block text-sm font-bold text-amber-600 hover:underline">
                Tampilkan semua barang
              </Link>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
