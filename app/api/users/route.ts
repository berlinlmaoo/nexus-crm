import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error: authError } = await requireRole(['OWNER', 'MANAGER', 'STAFF_GUDANG', 'STAFF_DAPUR']);
  if (authError) return authError;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.from('users').select('id, name, email, role, photo_url').order('name');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
