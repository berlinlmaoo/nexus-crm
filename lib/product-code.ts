/**
 * Kode barang otomatis: BB-001, BB-002, dan seterusnya.
 *
 * "BB" = Bahan Baku, prefix yang udah dipakai sistem ini dari awal — dipertahankan biar kode di
 * label barcode yang udah tercetak (dan kebiasaan orang gudang) nggak berubah artinya.
 *
 * Nomornya diambil dari kode TERBESAR yang ada, bukan dari jumlah baris. Kalau pakai jumlah baris,
 * begitu ada satu barang dihapus nomornya bakal keulang dan langsung nabrak UNIQUE constraint.
 */
export const CODE_PREFIX = 'BB';
const POLA = /^BB-(\d+)$/i;

export function nextCodeFrom(codes: (string | null | undefined)[]): string {
  let tertinggi = 0;
  for (const code of codes) {
    const cocok = POLA.exec((code || '').trim());
    if (cocok) tertinggi = Math.max(tertinggi, parseInt(cocok[1], 10));
  }
  // Padding 3 digit biar urutannya bener waktu diurut sebagai teks (BB-002 sebelum BB-010).
  // Lewat 999 padding-nya nambah sendiri — nggak dipaksa 3 digit sampai bentrok.
  return `${CODE_PREFIX}-${String(tertinggi + 1).padStart(3, '0')}`;
}
