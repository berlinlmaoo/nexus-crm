import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stock/units/consume — keluarin / buang barang, per nomor seri.
 *
 * Semua pemeriksaan yang berarti ada di `consume_stock_units()` di database, bukan di sini:
 * nomor nggak terdaftar, nomor yang udah kepakai, dan penguncian barisnya harus satu paket sama
 * penulisannya. Kalau dicek di sini dulu baru ditulis, ada jeda di antaranya — dua terminal bisa
 * lolos pemeriksaan yang sama terus dua-duanya ngeluarin unit yang sama.
 */
export async function POST(request: Request) {
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request bukan JSON yang valid' }, { status: 400 });
  }

  const type = String(body?.type ?? '').toUpperCase();
  if (type !== 'OUT' && type !== 'WASTE') {
    return NextResponse.json({ error: 'Tipe harus OUT atau WASTE' }, { status: 400 });
  }

  const serials = Array.isArray(body?.serials)
    ? Array.from(new Set(body.serials.map((s: any) => String(s ?? '').trim().toUpperCase()).filter(Boolean)))
    : [];

  if (serials.length === 0) return NextResponse.json({ error: 'Belum ada barang yang discan' }, { status: 400 });
  if (serials.length > 500) return NextResponse.json({ error: 'Maksimal 500 unit sekali transaksi' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('consume_stock_units', {
    p_serials: serials,
    p_type: type,
    p_user: user.id,
    p_notes: typeof body?.notes === 'string' ? body.notes : null,
  });

  if (error) {
    // Pesan dari fungsi database itu yang paling berguna buat orang gudang ("Unit X udah keluar
    // tanggal Y oleh Z"), jadi diteruskan apa adanya, bukan diganti pesan umum.
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ data });
}
