import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Menggunakan SERVICE_ROLE_KEY agar proses Update/Insert 
// bebas dari blokir RLS (Row Level Security) murni dari sisi server.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_id, type, quantity, notes } = body;

    if (!product_id || !type || !quantity) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Insert to stock_transactions using Admin Key
    const { data, error } = await supabaseAdmin
      .from('stock_transactions')
      .insert([{
        product_id,
        type,
        quantity,
        notes
      }])
      .select()
      .single();

    if (error) {
      console.error("Insert Transaction Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Success', data });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
