import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Siapa yang manggil route handler ini, dan boleh nggak dia nulis.
 *
 * Ini ada karena `middleware.ts` matcher-nya sengaja ngecualiin `api` (lihat komentar di
 * config.matcher), jadi NGGAK ADA satu pun route handler yang kejaga pengecekan sesi.
 * Beberapa route tulis — stock/update, stock/update-batch, opname — bikin klien Supabase
 * pakai SUPABASE_SERVICE_ROLE_KEY, yang nembus RLS. Gabungan dua hal itu artinya siapa pun
 * yang bisa nyentuh URL-nya bisa nulis ke database tanpa login sama sekali. Dan CRM ini
 * kebuka ke internet lewat cloudflared, jadi "siapa pun" itu harfiah.
 *
 * Guard ini yang nutup lubangnya, dan wajib dipanggil PALING ATAS di tiap handler yang nulis,
 * sebelum body request dibaca.
 *
 * Pakai `getUser()`, bukan `getSession()`: getSession cuma baca cookie apa adanya, sedangkan
 * getUser mem-verifikasi JWT-nya ke server auth. Buat keputusan otorisasi, cuma yang kedua
 * yang berarti.
 */

/** Yang boleh ngatur master barang. Dapur cuma lihat — mereka nggak megang gudang. */
export const CAN_MANAGE_PRODUCTS = ['OWNER', 'MANAGER', 'STAFF_GUDANG'] as const;
/** Yang boleh nyatet pergerakan stok (masuk/keluar/opname). */
export const CAN_MOVE_STOCK = ['OWNER', 'MANAGER', 'STAFF_GUDANG', 'STAFF_DAPUR'] as const;

export type ApiUser = { id: string; name: string; role: string };

type Guard = { user: ApiUser; error: null } | { user: null; error: NextResponse };

export async function requireRole(allowed: readonly string[]): Promise<Guard> {
  const supabase = createClient();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return { user: null, error: NextResponse.json({ error: 'Belum login' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role, is_active')
    .eq('id', auth.user.id)
    .single();

  // Akun yang belum di-approve owner punya baris tapi is_active false — itu bukan "belum login",
  // jadi 403 dan bukan 401. Bedanya penting buat pesan di UI.
  if (!profile || profile.is_active !== true) {
    return { user: null, error: NextResponse.json({ error: 'Akun belum diaktifkan' }, { status: 403 }) };
  }

  if (!profile.role || !allowed.includes(profile.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Role kamu nggak punya akses ke aksi ini' }, { status: 403 }),
    };
  }

  return { user: { id: profile.id, name: profile.name, role: profile.role }, error: null };
}
