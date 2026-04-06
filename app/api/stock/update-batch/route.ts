import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, type, notes, reference } = body;
    
    // items: [{ product_id, quantity }]

    if (!items || !items.length || !type) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const payload = items.map((item: any) => ({
      product_id: item.product_id,
      type,
      quantity: item.quantity,
      notes: notes || `Batch Scanner ${type}`,
      reference: reference || null
    }));

    const { data, error } = await supabaseAdmin
      .from('stock_transactions')
      .insert(payload);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Success', data });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
