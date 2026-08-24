import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH — Owner nyetujuin atau nolak PO.
 *
 * Role-nya dicek dua kali (di sini dan di dalam `putuskan_po()`), dan itu disengaja: yang di
 * sini biar pesannya cepat dan enak dibaca, yang di database biar aturannya tetap berlaku walau
 * ada yang manggil PostgREST langsung tanpa lewat route ini.
 */
export async function PATCH(request: Request) {
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Cuma Owner yang boleh nyetujuin atau nolak PO' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body request bukan JSON yang valid' }, { status: 400 });
  }

  const poId = String(body?.po_id ?? '').trim();
  if (!poId) return NextResponse.json({ error: 'po_id wajib diisi' }, { status: 400 });

  const setuju = Boolean(body?.setuju);
  const alasan = String(body?.alasan ?? '').trim();
  if (!setuju && !alasan) {
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('putuskan_po', {
    p_po: poId,
    p_setuju: setuju,
    p_alasan: alasan || null,
    p_user: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ data });
}
