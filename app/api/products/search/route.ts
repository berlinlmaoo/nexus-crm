import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q'); // Boleh barcode, boleh text code

  if (!q) {
    return NextResponse.json({ error: 'Parameter q (query) dibutuhkan' }, { status: 400 });
  }

  const supabase = createClient();
  
  // Mencari produk berdasarkan 'code' ATAU 'barcode'.
  // Kita cek ilike 'code' karena barcode table masih kosong di DB, jadi QR yang scan text (misal "BB-001") akan dikenali
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`code.ilike.%${q}%,barcode.eq.${q}`)
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Produk tidak ditemukan', data: null }, { status: 404 });
  }

  return NextResponse.json({ data });
}
