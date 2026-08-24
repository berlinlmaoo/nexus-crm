import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK, CAN_MANAGE_PRODUCTS } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/stock/units?serial=BB-001-0001  — cari satu unit buat scanner.
 * GET /api/stock/units?product_id=…        — daftar unit satu barang (buat cetak ulang stiker).
 *
 * Unit yang udah keluar TETAP dibalikin (bukan 404), lengkap sama kapan dan sama siapa —
 * justru itu jawaban yang dibutuhin scanner waktu ada stiker dipakai dua kali.
 */
export async function GET(request: Request) {
  const { error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const serial = searchParams.get('serial')?.trim().toUpperCase();
  const productId = searchParams.get('product_id')?.trim();

  const kolom = 'id, serial, seq, status, consumed_at, received_ref, product_id, products:product_id(id, code, name, unit, price)';

  if (serial) {
    const { data, error } = await supabaseAdmin
      .from('stock_units')
      .select(`${kolom}, consumer:consumed_by(name)`)
      .eq('serial', serial)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: `Nomor unit "${serial}" nggak terdaftar`, data: null }, { status: 404 });
    return NextResponse.json({ data });
  }

  if (productId) {
    const status = searchParams.get('status');
    let q = supabaseAdmin.from('stock_units').select(kolom).eq('product_id', productId).order('seq');
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Butuh parameter serial atau product_id' }, { status: 400 });
}

/**
 * POST /api/stock/units — barang datang: bikin N unit + stikernya.
 *
 * Yang dibikin di sini cuma NOMOR-nya, statusnya PENDING — stok belum gerak sama sekali. Barang
 * baru jadi stok setelah stikernya ditempel dan ditembak di Terminal (lihat units/validate).
 *
 * Dibatasi CAN_MANAGE_PRODUCTS (Owner/Manager/Staff Gudang), BUKAN semua role: ini pintu masuk
 * barang, dan kalau semua orang bisa bikin unit, "buku digelembungin dulu baru barangnya
 * diambil" jadi jalan yang kebuka lebar.
 */
export async function POST(request: Request) {
  const { user, error: authError } = await requireRole(CAN_MANAGE_PRODUCTS);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request bukan JSON yang valid' }, { status: 400 });
  }

  const productId = String(body?.product_id ?? '').trim();
  const count = Number(body?.count);
  const reference = typeof body?.reference === 'string' ? body.reference : null;
  const poId = String(body?.po_id ?? '').trim() || null;

  if (!productId) return NextResponse.json({ error: 'Barang wajib dipilih' }, { status: 400 });
  if (!Number.isFinite(count) || count < 1) return NextResponse.json({ error: 'Jumlah unit minimal 1' }, { status: 400 });
  if (count > 500) return NextResponse.json({ error: 'Maksimal 500 unit sekali terima' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('mint_stock_units', {
    p_product: productId,
    p_count: Math.trunc(count),
    p_user: user.id,
    p_ref: reference,
    p_po: poId,
  });

  if (error) {
    console.error('Mint units error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
