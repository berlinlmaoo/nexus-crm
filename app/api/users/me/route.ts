import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { id, photo_url } = await request.json();

    if (!id || !photo_url) {
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
