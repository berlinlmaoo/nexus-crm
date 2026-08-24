/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    /**
     * Jangan pakai ulang salinan halaman dinamis dari cache router di browser.
     *
     * Bawaan Next 14 nyimpen hasil render tiap halaman yang udah dibuka selama 30 detik, dan
     * mindahin halaman dalam rentang itu ngasih salinan lama TANPA nanya ke server. Buat blog
     * itu bagus; buat aplikasi gudang itu racun — hapus barang, balik ke daftar, barangnya masih
     * ada di sana lengkap dengan stok dan nilai asetnya. Potretnya utuh dan konsisten, jadi
     * nggak kelihatan kayak error sama sekali; cuma kelihatan salah kalau orangnya inget dia
     * barusan ngapain.
     *
     * Semua halaman di app ini `force-dynamic` alias emang selalu dirender ulang di server, jadi
     * yang dikorbanin cuma satu: pindah halaman jadi minta data lagi, bukan langsung dari
     * ingatan. Buat aplikasi yang angkanya dipakai ngitung stok beneran, itu harga yang murah.
     *
     * Ini lapis kedua. Lapis pertamanya `segarkanData()` di app/actions.ts yang dipanggil tiap
     * habis ngubah data — dua-duanya dipasang karena yang pertama gampang kelupaan waktu nambah
     * form baru, dan yang ini jaring pengamannya.
     */
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
};

export default nextConfig;
