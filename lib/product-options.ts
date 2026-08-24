import { createClient } from '@/lib/supabase/server';
import { nextCodeFrom } from '@/lib/product-code';

/**
 * Isi datalist buat kolom Kategori & Satuan di form barang: apa pun yang udah dipakai barang lain,
 * plus daftar dasar.
 *
 * Daftar dasarnya bukan hiasan — tabel `products` bakal kosong melompong pas fitur ini dipakai
 * pertama kali, dan datalist kosong artinya orang pertama yang daftarin barang ngetik satuan
 * seenaknya ("gram", "Gr", "gr") dan seterusnya ikut-ikutan berantakan.
 */
const KATEGORI_DASAR = ['Bahan Baku', 'Kemasan', 'Peralatan'];
const SATUAN_DASAR = ['gr', 'kg', 'ml', 'liter', 'pcs', 'pack', 'botol', 'sachet', 'dus'];

export async function getProductOptions(): Promise<{ categories: string[]; units: string[]; nextCode: string }> {
  const supabase = createClient();
  const { data } = await supabase.from('products').select('code, category, unit');

  const uniq = (dipakai: string[], dasar: string[]) =>
    Array.from(new Set([...dipakai.filter(Boolean), ...dasar])).sort((a, b) => a.localeCompare(b, 'id'));

  return {
    categories: uniq((data || []).map((p: any) => p.category), KATEGORI_DASAR),
    units: uniq((data || []).map((p: any) => p.unit), SATUAN_DASAR),
    // Cuma usulan buat ngisi form. Yang bener-bener nentuin kode tetap server pas nyimpen —
    // dua orang yang buka form barengan lihat usulan yang sama, dan itu wajar.
    nextCode: nextCodeFrom((data || []).map((p: any) => p.code)),
  };
}
