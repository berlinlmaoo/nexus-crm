import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST — borongan request jadi SATU purchase order.
 *
 * Pengecekan yang berarti (role, status tiap request, penguncian baris) semuanya di dalam
 * `buat_po_dari_requests()` di database. Kalau dicek di sini dulu baru ditulis, ada jeda di
 * antaranya — dua manager yang milih request yang sama barengan bisa lolos dua-duanya dan bikin
 * dua PO buat barang yang sama.
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

  const ids = Array.isArray(body?.request_ids)
    ? Array.from(new Set(body.request_ids.map((x: any) => String(x ?? '').trim()).filter(Boolean)))
    : [];

  if (ids.length === 0) return NextResponse.json({ error: 'Belum ada request yang dipilih' }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: 'Maksimal 200 request sekali jadiin PO' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('buat_po_dari_requests', {
    p_request_ids: ids,
    p_user: user.id,
    p_notes: typeof body?.notes === 'string' ? body.notes : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ data }, { status: 201 });
}
