import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: All products with current stock for opname form
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, code, name, category, unit, current_stock, min_stock, price')
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST: Submit opname — save ALL counted items + adjust stock for discrepancies
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, user_id, notes } = body;
    // items: [{ product_id, system_stock, physical_count }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items wajib diisi' }, { status: 400 });
    }

    const discrepancies = items.filter(i => Number(i.physical_count) !== Number(i.system_stock));
    const reference = `OPNAME-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 900) + 100}`;

    // 1. Create opname session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('opname_sessions')
      .insert({
        reference,
        petugas_id: user_id || null,
        notes: notes || null,
        total_items: items.length,
        total_discrepancies: discrepancies.length,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    // 2. Insert ALL opname_items (including those that match)
    const opnameItems = items.map(item => ({
      session_id: session.id,
      product_id: item.product_id,
      system_stock: Number(item.system_stock),
      physical_count: Number(item.physical_count),
      selisih: Number(item.physical_count) - Number(item.system_stock),
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('opname_items')
      .insert(opnameItems);

    if (itemsError) {
      console.error('Items insert error:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // 3. Create stock_transactions only for discrepancies (to actually adjust stock)
    if (discrepancies.length > 0) {
      const transactions = discrepancies.map(item => ({
        product_id: item.product_id,
        type: 'OPNAME',
        quantity: Number(item.physical_count),
        user_id: user_id || null,
        notes: `Stock Opname ${reference} — Selisih: ${Number(item.physical_count) - Number(item.system_stock)}`,
        reference,
      }));

      const { error: txError } = await supabaseAdmin
        .from('stock_transactions')
        .insert(transactions);

      if (txError) {
        console.error('Transaction insert error:', txError);
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      message: discrepancies.length > 0
        ? `Opname selesai. ${discrepancies.length} item disesuaikan dari ${items.length} yang diperiksa.`
        : `Opname selesai. Semua ${items.length} item stok sudah sesuai!`,
      adjusted: discrepancies.length,
      total: items.length,
      session_id: session.id,
      reference,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
