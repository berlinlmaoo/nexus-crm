import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
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
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  try {
    const body = await request.json();
    // Pengaju diambil dari sesi, bukan dari body: PO itu dokumen yang minta persetujuan, jadi
    // "siapa yang ngajuin" nggak boleh bisa diketik sendiri sama pengirim request.
    const { product_id, quantity, unit_price, notes } = body;
    const requester_id = user.id;

    if (!product_id || !quantity) {
      return NextResponse.json({ error: 'product_id dan quantity wajib diisi' }, { status: 400 });
    }

    // Generate PO number: PO-YYYYMMDD-XXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 900) + 100;
    const po_number = `PO-${dateStr}-${random}`;

    const total_price = unit_price ? quantity * unit_price : null;

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .insert([{
        po_number,
        product_id,
        quantity,
        unit_price: unit_price || null,
        total_price,
        status: 'PENDING_MANAGER',
        requester_id,
        notes
      }])
      .select()
      .single();

    if (error) {
      console.error('PO Insert Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'PO berhasil dibuat', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, approver_id } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id dan status wajib diisi' }, { status: 400 });
    }

    const updateData: any = { status };
    if (approver_id) updateData.approver_id = approver_id;
    if (status === 'APPROVED') updateData.approved_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: 'Status PO diperbarui', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
