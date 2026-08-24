import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(request: Request) {
  // Route ini yang nentuin siapa boleh apa di seluruh aplikasi, dan dulu jalan tanpa cek apa pun:
  // siapa saja yang bisa nyentuh URL-nya bisa ngirim {userId, newRole:"OWNER"} dan jadi owner.
  // Halaman /users juga nggak dibatasi middleware (yang dibatasi cuma /, /report, /settings),
  // jadi staff gudang pun kebuka jalannya.
  const { user, error: authError } = await requireRole(['OWNER', 'MANAGER']);
  if (authError) return authError;

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

    // Nggak bisa ngubah role diri sendiri. Ini yang bikin manager nggak bisa naikin dirinya
    // jadi owner, dan sekalian nutup jalan owner nyabut role-nya sendiri sampai kekunci keluar.
    if (userId === user.id) {
      return NextResponse.json({ error: 'Role sendiri nggak bisa diubah dari sini' }, { status: 403 });
    }

    // Cuma owner yang boleh ngangkat atau nurunin owner.
    const { data: target } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    if (user.role !== 'OWNER' && (newRole === 'OWNER' || target?.role === 'OWNER')) {
      return NextResponse.json({ error: 'Cuma OWNER yang boleh ngatur role OWNER' }, { status: 403 });
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
