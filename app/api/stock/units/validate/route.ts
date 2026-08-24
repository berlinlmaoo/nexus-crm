import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stock/units/validate — barang masuk beneran nyampe gudang.
 *
 * Ini titik di mana stok naik. Bukan waktu nomornya dibikin, bukan waktu stikernya dicetak —
 * tapi waktu stiker yang udah nempel di barang fisiknya ditembak di Terminal. Jadi kalau
 * dicetak 50 stiker dan yang dateng cuma 47, tiga sisanya ketinggalan sebagai "menunggu
 * validasi" dan kelihatan, bukan diam-diam kehitung sebagai stok.
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

  const serials = Array.isArray(body?.serials)
    ? Array.from(new Set(body.serials.map((s: any) => String(s ?? '').trim().toUpperCase()).filter(Boolean)))
    : [];

  if (serials.length === 0) return NextResponse.json({ error: 'Belum ada barang yang discan' }, { status: 400 });
  if (serials.length > 500) return NextResponse.json({ error: 'Maksimal 500 unit sekali transaksi' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('validate_stock_units', {
    p_serials: serials,
    p_user: user.id,
    p_notes: typeof body?.notes === 'string' ? body.notes : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ data });
}
