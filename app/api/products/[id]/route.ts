import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MANAGE_PRODUCTS } from '@/lib/api-auth';
import { validateProduct, conflictMessage } from '../route';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Ubah data master barang. Form-nya ngirim semua kolom sekaligus, jadi validasinya sama persis
 * kayak bikin baru.
 *
 * `current_stock` SENGAJA nggak bisa diubah dari sini. Stok cuma gerak lewat transaksi — itu
 * kebijakan yang udah dipegang aplikasi ini ("Input Manual Dinonaktifkan", semua lewat Terminal
 * Scanner). Kalau edit master bisa nyetel stok diam-diam, riwayatnya bohong dan angka opname
 * nggak ada artinya.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error: authError } = await requireRole(CAN_MANAGE_PRODUCTS);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request bukan JSON yang valid' }, { status: 400 });
  }

  const parsed = validateProduct(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { current_stock, ...master } = parsed.value;

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({ ...master, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    const conflict = conflictMessage(error);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Barang nggak ketemu' }, { status: 404 });
    console.error('Update product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * Hapus barang.
 *
 * FK dari `stock_transactions`, `purchase_orders`, dan `stock_units` itu ON DELETE CASCADE, jadi
 * hapus satu barang ikut ngehapus seluruh riwayat stok, PO, dan nomor unitnya. Buat barang yang
 * salah ketik pas didaftarin itu nggak masalah; buat barang yang udah kepakai berbulan-bulan itu
 * ngehapus pembukuan.
 *
 * Dulu jalur kedua diblokir mentah-mentah. Itu keliru — yang punya toko berhak ngehapus datanya
 * sendiri; yang dia butuhin bukan larangan, tapi tahu persis apa yang ikut hilang. Jadi
 * sekarang:
 *   - barang tanpa riwayat  → langsung kehapus.
 *   - barang yang ada riwayatnya → 409 berisi RINCIAN jumlahnya, biar UI bisa nanya dengan
 *     angka yang beneran, bukan peringatan umum.
 *   - `?force=1` → beneran dihapus, TAPI cuma OWNER. Staff gudang boleh beberes barang yang
 *     salah daftar; ngehapus pembukuan itu keputusan yang megang toko.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { user, error: authError } = await requireRole(CAN_MANAGE_PRODUCTS);
  if (authError) return authError;

  const force = new URL(request.url).searchParams.get('force') === '1';

  const [{ count: txCount }, { count: poCount }, { count: unitCount }] = await Promise.all([
    supabaseAdmin.from('stock_transactions').select('id', { count: 'exact', head: true }).eq('product_id', params.id),
    supabaseAdmin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('product_id', params.id),
    supabaseAdmin.from('stock_units').select('id', { count: 'exact', head: true }).eq('product_id', params.id),
  ]);

  const rincian = {
    transaksi: txCount || 0,
    po: poCount || 0,
    unit: unitCount || 0,
  };
  const adaRiwayat = rincian.transaksi + rincian.po + rincian.unit > 0;

  if (adaRiwayat && !force) {
    return NextResponse.json({
      error: 'Barang ini punya riwayat. Konfirmasi dulu sebelum dihapus.',
      rincian,
      butuhKonfirmasi: true,
    }, { status: 409 });
  }

  if (adaRiwayat && user.role !== 'OWNER') {
    return NextResponse.json({
      error: 'Cuma OWNER yang boleh menghapus barang yang udah punya riwayat stok. Nonaktifin aja, atau minta owner yang hapus.',
    }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('products').delete().eq('id', params.id);
  if (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, terhapus: rincian });
}
