import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH — tolak atau batalin satu request.
 *
 * Dua aksi yang beda maksudnya, dan sengaja dipisah biar papannya jujur:
 *   - `batal`  : yang ngajuin nyabut permintaannya sendiri.
 *   - `tolak`  : Manager/Owner mutusin permintaan ini nggak dibeli, dan wajib ninggalin alasan.
 * Dua-duanya cuma boleh dari status BARU — request yang udah jadi PO nggak bisa dianulir di
 * sini, karena pesanannya udah jalan.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request bukan JSON yang valid' }, { status: 400 });
  }

  const aksi = String(body?.aksi ?? '');
  if (aksi !== 'tolak' && aksi !== 'batal') {
    return NextResponse.json({ error: 'Aksi harus "tolak" atau "batal"' }, { status: 400 });
  }

  const { data: pr } = await supabaseAdmin
    .from('purchase_requests')
    .select('id, status, requester_id, request_number')
    .eq('id', params.id)
    .maybeSingle();

  if (!pr) return NextResponse.json({ error: 'Request nggak ketemu' }, { status: 404 });
  if (pr.status !== 'BARU') {
    return NextResponse.json({ error: `Request ini statusnya udah ${pr.status.toLowerCase()}` }, { status: 409 });
  }

  if (aksi === 'batal' && pr.requester_id !== user.id) {
    return NextResponse.json({ error: 'Cuma yang ngajuin yang bisa membatalkan' }, { status: 403 });
  }
  if (aksi === 'tolak' && user.role !== 'OWNER' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Cuma Manager atau Owner yang bisa menolak' }, { status: 403 });
  }

  const alasan = String(body?.alasan ?? '').trim();
  if (aksi === 'tolak' && !alasan) {
    // Alasan diwajibin: yang ngajuin harus tahu kenapa, kalau nggak dia bakal ngajuin lagi
    // barang yang sama minggu depan.
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('purchase_requests')
    .update({
      status: aksi === 'tolak' ? 'DITOLAK' : 'DIBATALKAN',
      reject_reason: aksi === 'tolak' ? alasan : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'BARU');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
