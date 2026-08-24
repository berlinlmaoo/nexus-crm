import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PILIH = `
  id, request_number, quantity, estimated_price, urgency, notes, department, status,
  reject_reason, po_id, created_at,
  products:product_id (id, code, name, unit, current_stock, min_stock),
  requester:requester_id (id, name, role),
  po:po_id (id, po_number, status)
`;

/** GET — isi papan Purchase Request. */
export async function GET(request: Request) {
  const { error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  const status = new URL(request.url).searchParams.get('status');
  let q = supabaseAdmin.from('purchase_requests').select(PILIH).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * POST — satu head ngajuin kebutuhannya.
 *
 * Kebuka buat SEMUA staff aktif, dan itu disengaja: yang paling tahu dapur mau habis apa ya
 * orang dapur. Yang dijaga bukan siapa boleh minta, tapi siapa boleh mesen (Manager/Owner) dan
 * siapa boleh nyetujuin (Owner).
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

  const productId = String(body?.product_id ?? '').trim();
  const quantity = Number(body?.quantity);
  const hargaRaw = body?.estimated_price;
  const estimated = hargaRaw === null || hargaRaw === undefined || hargaRaw === '' ? null : Number(hargaRaw);

  if (!productId) return NextResponse.json({ error: 'Barang wajib dipilih' }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 1) return NextResponse.json({ error: 'Jumlah minimal 1' }, { status: 400 });
  if (estimated !== null && (!Number.isFinite(estimated) || estimated < 0)) {
    return NextResponse.json({ error: 'Perkiraan harga harus angka dan nggak boleh minus' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('buat_purchase_request', {
    p_product: productId,
    p_qty: Math.trunc(quantity),
    p_harga: estimated === null ? null : Math.trunc(estimated),
    p_urgency: body?.urgency === 'URGENT' ? 'URGENT' : 'NORMAL',
    p_notes: typeof body?.notes === 'string' ? body.notes : null,
    p_user: user.id,
  });

  if (error) {
    console.error('Create PR error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
