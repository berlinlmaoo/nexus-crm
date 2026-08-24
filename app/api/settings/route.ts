import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Config ini isinya titik GPS kantor dan batas jam absen — bukan hal yang perlu kebaca
  // orang lewat yang nggak login.
  const { error: authError } = await requireRole(['OWNER', 'MANAGER', 'STAFF_GUDANG', 'STAFF_DAPUR']);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from('restaurant_config')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  // Config restoran nentuin titik kantor & batas jam absen — itu setelan yang cuma boleh
  // disentuh yang megang toko.
  const { error: authError } = await requireRole(['OWNER', 'MANAGER']);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Check if a config row already exists
    const { data: existing } = await supabaseAdmin
      .from('restaurant_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      // Update existing row
      const { data, error } = await supabaseAdmin
        .from('restaurant_config')
        .update(body)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      result = data;
    } else {
      // Insert new row
      const { data, error } = await supabaseAdmin
        .from('restaurant_config')
        .insert(body)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      result = data;
    }

    return NextResponse.json({ data: result, message: 'Pengaturan berhasil disimpan.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
