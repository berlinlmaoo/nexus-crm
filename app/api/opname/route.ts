import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: All products with current stock for opname form
export async function GET() {
  const { error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, code, name, category, unit, current_stock, min_stock, price')
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * POST: kirim hasil hitung fisik.
 *
 * Seluruh sesi masuk lewat SATU pemanggilan `submit_opname()` di Postgres, bukan tiga insert
 * berturut-turut dari sini. Versi lama nulis sesi → item → penyesuaian stok satu per satu tanpa
 * transaksi, jadi kalau langkah terakhir gagal yang ketinggal adalah sesi opname yang ngaku udah
 * nyesuaikan sekian barang padahal stoknya nggak pernah berubah. Body fungsi plpgsql itu atomik.
 *
 * Petugasnya diambil dari SESI, bukan dari dropdown di form. Opname itu satu-satunya jalur yang
 * bisa nyetel stok ke angka berapa pun, jadi "siapa yang ngitung" nggak boleh bisa dipilih
 * sendiri sama pengirim request.
 */
export async function POST(request: Request) {
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { items, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items wajib diisi' }, { status: 400 });
    }

    // Dibersihin di sini biar yang sampai ke SQL bentuknya pasti. Angka yang nggak kebaca
    // ditolak, bukan diam-diam jadi 0 — "0" itu hasil hitungan yang sah (barang habis), jadi
    // nggak boleh dipakai sebagai nilai darurat.
    const bersih: { product_id: string; system_stock: number; physical_count: number }[] = [];
    for (const [i, item] of items.entries()) {
      const productId = String(item?.product_id ?? '').trim();
      const systemStock = Number(item?.system_stock);
      const physicalCount = Number(item?.physical_count);

      if (!productId) {
        return NextResponse.json({ error: `Baris ke-${i + 1} nggak punya product_id` }, { status: 400 });
      }
      if (!Number.isFinite(systemStock) || !Number.isFinite(physicalCount)) {
        return NextResponse.json({ error: `Baris ke-${i + 1} angkanya nggak kebaca` }, { status: 400 });
      }
      if (physicalCount < 0) {
        return NextResponse.json({ error: `Hitungan fisik baris ke-${i + 1} nggak boleh minus` }, { status: 400 });
      }

      bersih.push({
        product_id: productId,
        system_stock: Math.trunc(systemStock),
        physical_count: Math.trunc(physicalCount),
      });
    }

    const { data, error } = await supabaseAdmin.rpc('submit_opname', {
      p_petugas: user.id,
      p_notes: typeof notes === 'string' ? notes : null,
      p_items: bersih,
    });

    if (error) {
      console.error('Opname error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const adjusted = Number(data?.adjusted ?? 0);
    const total = Number(data?.total ?? bersih.length);

    return NextResponse.json({
      message: adjusted > 0
        ? `Opname selesai. ${adjusted} item disesuaikan dari ${total} yang diperiksa.`
        : `Opname selesai. Semua ${total} item stok sudah sesuai!`,
      adjusted,
      total,
      session_id: data?.session_id,
      reference: data?.reference,
      // Unit yang baru lahir karena barangnya ketemu lebih banyak dari yang terdaftar.
      // Stikernya WAJIB dicetak — tanpa itu barangnya nggak bisa dikeluarin lewat scanner.
      serials_baru: data?.serials_baru ?? [],
      product_ids: bersih.map((i) => i.product_id),
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
