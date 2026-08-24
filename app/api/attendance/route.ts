import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, CAN_MOVE_STOCK } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  // CAN_MOVE_STOCK kebetulan = semua role yang ada; yang penting di sini orangnya kelogin dan
  // akunnya aktif. Absen atas nama orang lain itu persis yang bikin absensi nggak ada gunanya.
  const { user, error: authError } = await requireRole(CAN_MOVE_STOCK);
  if (authError) return authError;

  try {
    const body = await request.json();
    // `user_id` dari body diabaikan — yang absen adalah yang lagi login.
    const { check_type, latitude, longitude, photo_base64 } = body;
    const user_id = user.id;

    if (!check_type) {
      return NextResponse.json({ error: 'Tipe Absensi wajib diisi' }, { status: 400 });
    }

    // 1. Dapatkan Config Restoran (Untuk batas waktu/lokasi)
    const { data: config } = await supabaseAdmin.from('restaurant_config').select('*').limit(1).single();

    let distance = null;
    let computedStatus = "ONTIME"; // default status

    // 2. Kalkulasi Jarak Geolocation (Haversine formula simple)
    if (latitude && longitude && config?.office_lat && config?.office_lng) {
      const R = 6371e3; // metres
      const phi1 = (latitude * Math.PI) / 180;
      const phi2 = (config.office_lat * Math.PI) / 180;
      const deltaPhi = ((config.office_lat - latitude) * Math.PI) / 180;
      const deltaLambda = ((config.office_lng - longitude) * Math.PI) / 180;

      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      distance = Math.round(R * c); // Round to integer to match DB column type
      
      // Cek radius radius_meter (default 100)
      const allowedRadius = config.radius_meter || 100;
      if (distance > allowedRadius) {
        computedStatus = "OUT_OF_RANGE";
      }
    } else {
       computedStatus = "OUT_OF_RANGE";
    }

    // Cek Keterlambatan sederhana berdasarkan jam masuk 08:00
    // Asumsi zona waktu UTC+7 / WIB sesuai request
    const now = new Date();
    const currentHour = now.getHours(); // simplified
    const isCheckIn = check_type === 'IN';
    
    if (isCheckIn && computedStatus !== "OUT_OF_RANGE") {
       // Konversi kasar ke jam masuk
       // Default config start_time = 08:00
       if (currentHour >= 9) { // Hardcode sederhana jika lebih dari jam 9 pagi anggap LATE
          computedStatus = "LATE";
       }
    }

    // 3. (Opsional/Masa Depan) Upload photo_base64 ke storage Supabase, di sini mock string path sementara
    let photo_url = null;
    if (photo_base64) {
       photo_url = photo_base64; // In real app, we buffer and upload. Here we just store base64 string or mock it since storage API might need proper bucket setup.
    }

    // 4. Insert into attendance log
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .insert([{
        user_id,
        check_type,
        latitude,
        longitude,
        distance_from_office: distance,
        status: computedStatus,
        photo_url // Menyimpan string log data foto (base64)
      }])
      .select()
      .single();

    if (error) {
      console.error("Insert Attendance Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Absensi Diterima', data, distance, status: computedStatus });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
