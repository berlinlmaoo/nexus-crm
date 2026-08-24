import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { user, error: authError } = await requireRole(['OWNER', 'MANAGER', 'STAFF_GUDANG', 'STAFF_DAPUR']);
  if (authError) return authError;

  try {
    // `id` dari body diabaikan — yang bisa diganti cuma foto punya sendiri. Sebelumnya siapa pun
    // bisa nimpa foto profil orang lain cukup dengan nebak id-nya.
    const { photo_url } = await request.json();
    const id = user.id;

    if (!photo_url) {
      return NextResponse.json({ error: 'Missing requirements' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ photo_url })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Success updated profile picture' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
