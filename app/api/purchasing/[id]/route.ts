import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .select(`
      *,
      products:product_id (name, unit, price),
      requester:requester_id (name, role),
      approver:approver_id (name, role)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
