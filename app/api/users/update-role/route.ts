import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: Request) {
  try {
    const { userId, newRole } = await request.json();

    if (!userId || newRole === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Role enum valid values, or NULL for revoking
    const validRoles = ['OWNER', 'MANAGER', 'STAFF_GUDANG', 'STAFF_DAPUR'];
    if (newRole !== null && !validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Role updated successfully', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
