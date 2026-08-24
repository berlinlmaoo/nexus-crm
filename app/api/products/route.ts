import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MANAGE_PRODUCTS } from '@/lib/api-auth';
import { nextCodeFrom } from '@/lib/product-code';

// Service-role dipakai buat NULIS-nya doang; izinnya udah diputus duluan sama requireRole().
// RLS di `products` cuma punya policy SELECT, jadi insert dari sesi biasa bakal ditolak —
// makanya otorisasi dikerjain di kode dan penulisannya lewat kunci admin.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Batas kolom di tabel `products`; dipotong di sini biar errornya jelas, bukan 500 dari Postgres. */
const LIMITS = { code: 20, name: 200, category: 50, unit: 20, barcode: 20 };

export type ProductInput = {
  code: string; name: string; category: string; unit: string;
  price: number; min_stock: number; current_stock: number;
  barcode: string | null; is_active: boolean;
};

/** Validasi bareng buat create & edit. Balikin pesan Indonesia, bukan pesan Postgres. */
export function validateProduct(body: any): { ok: true; value: ProductInput } | { ok: false; error: string } {
  const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
  const int = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
  };

  // Kode dipaksa huruf besar: scanner ngirim apa adanya dan pencarian pakai ilike, tapi kode yang
  // campur besar-kecil bikin daftar keliatan berantakan dan gampang bikin duplikat "bb-1" vs "BB-1".
  const code = str(body?.code).toUpperCase();
  const name = str(body?.name);
  const category = str(body?.category);
  const unit = str(body?.unit);
  const barcodeRaw = str(body?.barcode);

  if (!code) return { ok: false, error: 'Kode barang wajib diisi' };
  if (code.length > LIMITS.code) return { ok: false, error: `Kode barang maksimal ${LIMITS.code} karakter` };
  if (!name) return { ok: false, error: 'Nama barang wajib diisi' };
  if (name.length > LIMITS.name) return { ok: false, error: `Nama barang maksimal ${LIMITS.name} karakter` };
  if (!category) return { ok: false, error: 'Kategori wajib diisi' };
  if (category.length > LIMITS.category) return { ok: false, error: `Kategori maksimal ${LIMITS.category} karakter` };
  if (!unit) return { ok: false, error: 'Satuan wajib diisi (contoh: gr, ml, pcs)' };
  if (unit.length > LIMITS.unit) return { ok: false, error: `Satuan maksimal ${LIMITS.unit} karakter` };
  if (barcodeRaw.length > LIMITS.barcode) return { ok: false, error: `Barcode maksimal ${LIMITS.barcode} karakter` };

  const price = int(body?.price ?? 0);
  const min_stock = int(body?.min_stock ?? 0);
  const current_stock = int(body?.current_stock ?? 0);

  if (Number.isNaN(price) || price < 0) return { ok: false, error: 'Harga harus angka dan nggak boleh minus' };
  if (Number.isNaN(min_stock) || min_stock < 0) return { ok: false, error: 'Stok minimum harus angka dan nggak boleh minus' };
  if (Number.isNaN(current_stock) || current_stock < 0) return { ok: false, error: 'Stok awal harus angka dan nggak boleh minus' };

  return {
    ok: true,
    value: {
      code, name, category, unit, price, min_stock, current_stock,
      // Barcode kosong disimpan NULL, BUKAN string kosong: kolomnya UNIQUE, dan dua barang
      // tanpa barcode akan bentrok kalau dua-duanya diisi ''. NULL nggak pernah bentrok.
      barcode: barcodeRaw || null,
      is_active: body?.is_active === undefined ? true : Boolean(body.is_active),
    },
  };
}

/** Pesan buat bentrokan UNIQUE, dipakai create & edit. */
export function conflictMessage(error: { code?: string; message?: string }): string | null {
  if (error?.code !== '23505') return null;
  const m = error.message || '';
  if (m.includes('barcode')) return 'Barcode itu udah dipakai barang lain';
  if (m.includes('code')) return 'Kode barang itu udah dipakai';
  return 'Data itu udah ada di sistem';
}

/** Kode berikutnya menurut isi database SEKARANG. */
async function generateCode(): Promise<string> {
  const { data } = await supabaseAdmin.from('products').select('code');
  return nextCodeFrom((data || []).map((p: any) => p.code));
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireRole(CAN_MANAGE_PRODUCTS);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request bukan JSON yang valid' }, { status: 400 });
  }

  // Kode kosong artinya "pakai yang otomatis". Server yang jadi penentunya, bukan form: dua orang
  // yang buka halaman Tambah Barang barengan bakal lihat usulan kode yang SAMA, dan cuma yang
  // nyimpen duluan yang berhak atas nomor itu.
  const kodeOtomatis = !String(body?.code ?? '').trim();
  if (kodeOtomatis) body = { ...body, code: await generateCode() };

  const parsed = validateProduct(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  let p = parsed.value;

  // Produk selalu lahir dengan stok NOL, lalu stok awalnya dicatat sebagai transaksi OPNAME.
  //
  // Ini disengaja. Trigger `trg_stock_transaction` yang megang `products.current_stock`, dan buat
  // tipe OPNAME dia nge-SET stok ke `quantity` (bukan nambah), jadi nulis dua-duanya bakal dobel.
  // Lebih penting lagi: angka stok yang nggak punya transaksi itu angka yang nggak bisa
  // dipertanggungjawabkan — persis yang bikin data lama nggak kepercaya (70 barang punya stok
  // tanpa satu pun transaksi). Lewat sini, tiap angka stok selalu ada asal-usulnya.
  // Kalau kodenya otomatis dan keduluan orang lain, ambil nomor berikutnya dan coba lagi —
  // bukan lempar "kode udah dipakai" ke muka orang yang nggak pernah ngetik kode itu.
  let created: any = null;
  let error: any = null;
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    const hasil = await supabaseAdmin.from('products').insert([{ ...p, current_stock: 0 }]).select().single();
    created = hasil.data;
    error = hasil.error;
    if (!error) break;
    const bentrokKode = error.code === '23505' && (error.message || '').includes('code');
    if (!kodeOtomatis || !bentrokKode) break;
    p = { ...p, code: await generateCode() };
  }

  if (error) {
    const conflict = conflictMessage(error);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    console.error('Create product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (p.current_stock > 0) {
    const { error: txError } = await supabaseAdmin.from('stock_transactions').insert([{
      product_id: created.id,
      type: 'OPNAME',
      quantity: p.current_stock,
      notes: `Stok awal saat barang didaftarkan oleh ${user.name}`,
    }]);

    // Barangnya udah jadi; yang gagal cuma catatan stok awalnya. Jangan bikin seolah-olah
    // gagal total — user bakal nyoba daftarin ulang dan kena "kode udah dipakai".
    if (txError) {
      console.error('Opening stock error:', txError);
      return NextResponse.json({
        data: created,
        warning: 'Barang berhasil dibuat, tapi stok awalnya gagal dicatat. Isi lewat Terminal Scanner ya.',
      });
    }
  }

  return NextResponse.json({ data: { ...created, current_stock: p.current_stock } }, { status: 201 });
}
