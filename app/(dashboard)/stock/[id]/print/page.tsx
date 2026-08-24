"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Printer, Loader2, PackagePlus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from 'react-qr-code';

type Unit = { id: string; serial: string; seq: number; status: string };

/**
 * Satu stiker termal 50x30mm: QR code di kiri, keterangan di kanan.
 *
 * ── Kenapa QR, bukan barcode batang ──
 * Sebelumnya pakai CODE128, dan itu nggak pernah kebaca kamera HP. Bukan salah setelan —
 * ukurannya emang mustahil:
 *
 *   CODE128 buat "BB-001-0002" = 176 modul (termasuk zona sunyi) dijejer di 46mm
 *     → 1 batang = 0,26 mm, mepet banget sama batas resolusi kamera HP jarak deket
 *   QR versi 1  = 29 modul (termasuk zona sunyi) di 24mm
 *     → 1 kotak  = 0,83 mm, tiga kali lipat lebih besar
 *
 * Bedanya bukan cuma besar-kecil. Barcode batang naruh semua informasinya di SATU sumbu, jadi
 * makin panjang teksnya makin rapat batangnya. QR nyebar ke dua sumbu, jadi nambah karakter
 * bikin dia sedikit lebih padat, bukan makin mustahil. Dan QR punya koreksi kesalahan bawaan —
 * kotor, buram, atau ketutup sedikit masih kebaca; barcode batang nggak punya itu sama sekali.
 *
 * Nomor unitnya tetap dicetak sebagai teks di sebelahnya. Itu bukan hiasan: kalau stikernya
 * rusak atau kameranya lagi rewel, orang gudang bisa ngetik nomornya di kolom manual.
 */
function LabelStiker({ nama, serial, harga }: { nama: string; serial: string; harga?: number }) {
  return (
    <div className="thermal-label bg-white border border-stone-300 shadow-sm print:border-none print:shadow-none w-[50mm] h-[30mm] box-border">
      {/* Isinya dipisah ke lapisan sendiri supaya bisa diputar utuh waktu printernya ngumpan
          kertas dari sisi pendek — lihat CSS cetak di bawah. */}
      <div className="isi-stiker flex h-full w-full flex-row items-center gap-1.5 px-1.5 py-1 box-border">
        {/* Zona sunyi QR (4 modul tiap sisi) dibikin pakai padding putih di sekeliling, bukan
            diserahin ke tepi stiker — tepi stiker bisa kepotong pas dipasang di roll. */}
        <div className="shrink-0 bg-white p-[0.6mm]">
          <QRCode
            value={serial}
            size={256}
            level="M"
            style={{ width: "22mm", height: "22mm" }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[0.4mm]">
          <p className="text-[8px] font-bold text-black leading-tight line-clamp-2">{nama}</p>
          {/* Nomornya dibikin sebesar mungkin yang masih muat — ini yang diketik manual kalau
              QR-nya nggak kebaca, jadi harus enak dibaca mata, bukan cuma ada. */}
          <p className="text-[10px] font-black text-black font-mono leading-none tracking-tight">{serial}</p>
          <p className="text-[7px] text-black font-mono leading-none">Rp {harga?.toLocaleString('id-ID')}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Cetak stiker barcode — SATU STIKER PER UNIT FISIK, masing-masing nomornya beda.
 *
 * Dua cara masuk ke sini:
 *   ?serials=BB-001-0001,BB-001-0002  — habis bikin nomor, cetak yang baru itu aja.
 *   (tanpa parameter)                 — cetak ulang: unit yang belum divalidasi + yang masih
 *                                       di gudang.
 *
 * ── Kenapa stikernya dirender DUA KALI (pratinjau + salinan lewat portal) ──
 * Aturan cetaknya harus nyembunyiin seluruh isi aplikasi (sidebar, header, tombol) dan nyisain
 * stikernya doang. Cara yang paling bisa diandalkan buat itu `body > :not(...) { display:none }`,
 * TAPI itu cuma jalan kalau stikernya anak LANGSUNG dari <body>.
 *
 * Di app ini halaman selalu terkubur di dalam layout dashboard (body → div → div → main → div →
 * halaman), jadi aturan tadi malah ngenain pembungkus yang BERISI stikernya — dan hasil cetaknya
 * halaman kosong melompong. Itu bug yang beneran kejadian, bukan kekhawatiran teoretis.
 *
 * Jadi: yang di layar dirender biasa (dan disembunyiin waktu ngeprint), sementara salinan buat
 * dicetak ditempelin langsung ke <body> lewat portal. Salinan itu jadi anak langsung body, jadi
 * aturannya balik jadi benar dan sederhana. Sekalian nyelesaiin masalah kedua: layout dashboard
 * pakai `h-screen overflow-hidden`, yang bakal MOTONG stiker di luar layar pertama kalau
 * dicetak dari dalam sana.
 */
export default function PrintBarcodePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [product, setProduct] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [siapPortal, setSiapPortal] = useState(false);

  /**
   * Putar stikernya 90°.
   *
   * `@page { size: 50mm 30mm }` itu permintaan, bukan perintah. Banyak printer label ngumpanin
   * kertasnya sisi PENDEK duluan, jadi driver-nya nganggep medianya 30mm×50mm (tegak) dan
   * ngabaikan ukuran yang diminta halaman — hasilnya stiker kecetak memanjang ke bawah dan
   * kepotong. Nggak ada cara buat nanya ke printer dia ngumpan lewat mana, jadi ini disetel
   * manual sekali, lalu diinget di browser ini biar nggak usah diulang tiap ngeprint.
   */
  const [putar, setPutar] = useState(false);

  // Portal cuma boleh dipasang setelah komponennya hidup di browser — di server `document`
  // nggak ada.
  useEffect(() => {
    setSiapPortal(true);
    setPutar(localStorage.getItem('stiker-diputar') === '1');
  }, []);

  const gantiPutar = (nyala: boolean) => {
    setPutar(nyala);
    localStorage.setItem('stiker-diputar', nyala ? '1' : '0');
  };

  const diminta = (searchParams.get('serials') || '')
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const cetakUlang = diminta.length === 0;

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: u }] = await Promise.all([
        supabase.from('products').select('*').eq('id', params.id).single(),
        supabase.from('stock_units').select('id, serial, seq, status').eq('product_id', params.id).order('seq'),
      ]);

      if (p) setProduct(p);

      const semua = (u || []) as Unit[];
      setUnits(
        diminta.length > 0
          // Urutannya ngikutin nomor unit, bukan urutan di URL — hasil cetaknya jadi berurutan
          // dan gampang dicocokin sama barangnya waktu ditempel.
          ? semua.filter(x => diminta.includes(x.serial))
          // Tanpa parameter = cetak ulang. Yang paling butuh stiker itu unit yang MENUNGGU
          // VALIDASI (nomornya udah ada, stikernya belum nempel); yang udah jadi stok ikut
          // ditawarin buat stiker yang lepas atau kescan-nya udah nggak kebaca.
          : semua.filter(x => x.status === 'PENDING' || x.status === 'IN_STOCK')
      );
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!product) {
    return <div className="p-10 text-center font-bold text-stone-500">Produk tidak ada.</div>;
  }

  const handlePrint = () => window.print();

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900">Cetak Stiker Unit</h2>
            <p className="text-sm text-stone-500">
              {cetakUlang ? "Unit yang belum divalidasi + yang masih di gudang" : "Unit yang baru dibikin"} &middot; 50mm x 30mm (Zebra)
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <Button
            onClick={handlePrint}
            disabled={units.length === 0}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 sm:h-[60px] px-6 disabled:opacity-40"
          >
            <Printer className="h-5 w-5 mr-2" />
            Print ({units.length})
          </Button>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-stone-600">
            <input
              type="checkbox" checked={putar}
              onChange={(e) => gantiPutar(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <RotateCw className="h-3.5 w-3.5" />
            Putar 90° (kalau kecetak memanjang)
          </label>
        </div>
      </div>

      {units.length === 0 && (
        <div className="print:hidden rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-black text-stone-900">Nggak ada unit buat dicetak</h3>
          <p className="mx-auto mt-2 max-w-md text-stone-500">
            {cetakUlang
              ? `Semua unit ${product.name} udah keluar dari gudang, jadi nggak ada stiker yang perlu dicetak ulang.`
              : "Nomor unit yang diminta nggak ketemu di barang ini."}
          </p>
          <Link href="/stock/receive" className="mt-5 inline-block">
            <Button className="h-11 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              <PackagePlus className="h-4 w-4 mr-2" />
              Catat Barang Masuk
            </Button>
          </Link>
        </div>
      )}

      {units.length > 0 && !cetakUlang && (
        <div className="print:hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-bold">Habis dicetak: tempel stikernya, terus validasi.</p>
          <p className="mt-1">
            Stok belum naik sampai stikernya ditembak di Terminal Stok mode <b>Barang Masuk</b>.
            Kalau ada yang nggak nyampe, unitnya ketinggalan sebagai &quot;menunggu validasi&quot; — bukan
            diam-diam kehitung jadi stok.
          </p>
          <Link href="/stock/scan" className="mt-3 inline-block">
            <Button className="h-11 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              Buka Terminal Stok
            </Button>
          </Link>
        </div>
      )}

      {/* Pratinjau di layar. Waktu ngeprint yang ini disembunyiin — yang kecetak salinan portal. */}
      {units.length > 0 && (
        <div className="print:hidden flex flex-wrap gap-4 bg-stone-100 p-4 sm:p-8 rounded-2xl">
          {units.map((unit) => (
            <LabelStiker key={unit.id} nama={product.name} serial={unit.serial} harga={product.price} />
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        /* Salinan cetak nempel di <body>, jadi di layar dia harus disembunyiin dulu. */
        .print-root { display: none; }

        @media print {
          @page {
            /* Halaman ngikutin arah umpan kertas printernya, bukan sebaliknya. */
            size: ${putar ? "30mm 50mm" : "50mm 30mm"};
            margin: 0;
          }
          html, body { margin: 0; padding: 0; background: white; }

          /* Sekarang aturannya benar: .print-root MEMANG anak langsung <body>. */
          body > :not(.print-root) { display: none !important; }

          .print-root { display: block !important; }

          .thermal-label {
            width: ${putar ? "30mm" : "50mm"};
            height: ${putar ? "50mm" : "30mm"};
            page-break-after: always;
            break-after: page;
            overflow: hidden;
            background: white !important;
            position: relative;
          }

          /* Isinya tetap digambar 50x30 lalu diputar di tempat, BUKAN dibikin ulang dalam
             ukuran tegak — supaya QR-nya nggak ikut mengecil pas diputar.

             SUSUNANNYA SENGAJA NGGAK DISENTUH DI SINI. Aturan lama nulis flex-direction
             column di blok ini — sisa dari waktu stikernya masih susunan atas-bawah. Waktu
             stikernya diubah jadi QR-di-kiri-teks-di-kanan, aturan itu ketinggalan dan NIMPA
             susunan barunya cuma waktu dicetak: di layar keliatan bener, di kertas QR-nya
             numpuk di atas teks, tingginya lewat 30mm, dan bagian bawahnya kepotong. Susunan
             cuma boleh diatur sekali, di kelas komponennya. */
          .thermal-label > .isi-stiker {
            width: 50mm;
            height: 30mm;
            ${putar
              ? "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(90deg);"
              : ""}
          }

          /* Stiker terakhir jangan nyisain satu halaman kosong di belakang. */
          .thermal-label:last-child { page-break-after: auto; break-after: auto; }
        }
      `}} />

      {siapPortal && units.length > 0 && createPortal(
        <div className="print-root">
          {units.map((unit) => (
            <LabelStiker key={unit.id} nama={product.name} serial={unit.serial} harga={product.price} />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
