import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

// Menggunakan SERVICE_ROLE_KEY agar proses Update/Insert 
// bebas dari blokir RLS (Row Level Security) murni dari sisi server.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  // Route ini nulis pakai service-role, yang nembus RLS, dan middleware nggak jaga /api sama
  // sekali (matcher-nya ngecualiin 'api'). Tanpa guard ini siapa pun yang bisa nyentuh URL-nya
  // bisa ngubah stok tanpa login.
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

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
        notes,
        // Pelakunya diambil dari sesi, bukan dari body: siapa yang mindahin stok itu keterangan
        // yang cuma ada artinya kalau nggak bisa diketik sendiri sama pengirim request.
        user_id: user.id
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
