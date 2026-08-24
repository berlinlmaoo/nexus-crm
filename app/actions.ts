"use server";

import { revalidatePath } from "next/cache";

/**
 * Buang data basi di cache router setelah sesuatu diubah.
 *
 * ── Kenapa ini perlu ──
 * Pola yang dipakai di semua form sebelumnya salah, dan salahnya halus:
 *
 *     router.refresh();          // nyegerin halaman yang LAGI dibuka
 *     router.push("/stock");     // pindah ke halaman lain
 *
 * `router.refresh()` cuma ngurus rute yang lagi aktif. Begitu pindah ke `/stock`, Next ngambil
 * salinan `/stock` dari **Router Cache di browser** — salinan dari terakhir kali halaman itu
 * dibuka. Jadi yang disegerin bukan halaman yang bakal dilihat orangnya.
 *
 * Akibatnya kelihatan jelas waktu ngehapus barang: notifikasi bilang "dihapus", tapi daftarnya
 * masih nampilin barang itu lengkap dengan stok dan nilai asetnya — potret lama yang utuh dan
 * konsisten, jadi nggak kelihatan kayak error sama sekali. Cuma kelihatan salah kalau orangnya
 * inget dia barusan ngapain.
 *
 * `revalidatePath` yang dipanggil dari Server Action beda: dia ngebuang entri cache-nya di
 * server DAN di browser, buat rute yang disebut — jadi kunjungan berikutnya bener-bener ngambil
 * ulang. Semua halaman di app ini `force-dynamic`, jadi ngambil ulang emang selalu ngasih data
 * terbaru; yang selama ini bikin basi memang cuma cache router-nya.
 *
 * Dipanggil SEBELUM `router.push`, dan hasilnya di-`await` — kalau nggak ditunggu, pindah
 * halamannya bisa keburu jalan duluan sebelum cache-nya dibuang.
 */
export async function segarkanData(paths: string[]) {
  for (const path of paths) {
    if (!path) continue;
    // "layout" (bukan "page") supaya sidebar dan header yang ikut baca data — misalnya nama
    // restoran dan logo — ikut kesegerin juga.
    revalidatePath(path, "layout");
  }
}
