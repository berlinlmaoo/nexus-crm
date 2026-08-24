"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export default function BarcodeScanner({ onScanSuccess }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Callback disimpen di ref, dan effect di bawah dependensinya KOSONG.
  //
  // Ini bukan gaya-gayaan: `onScanSuccess` dibikin ulang tiap kali halaman induk render, jadi
  // kalau dia jadi dependensi effect, tiap perubahan state sekecil apa pun bakal ngebongkar dan
  // bikin ulang seluruh scanner. Efeknya di HP persis yang kelihatan kemarin — pilihan kamera
  // balik ke awal terus dan tampilannya lompat-lompat, karena elemennya emang lahir ulang.
  const onScanRef = useRef(onScanSuccess);
  useEffect(() => { onScanRef.current = onScanSuccess; }, [onScanSuccess]);

  useEffect(() => {
    try {
      scannerRef.current = new Html5QrcodeScanner(
        "barcode-reader",
        {
          fps: 10,

          /**
           * Kotak pindai PERSEGI, karena stikernya sekarang pakai QR.
           *
           * html5-qrcode cuma nge-decode isi kotak ini — sisanya dibuang sebelum diproses.
           * Setelan aslinya kotak 300x150 px di tengah, padahal video HP lebarnya 600-1000px,
           * jadi kode yang kefoto memenuhi layar ujungnya keluar kotak dan yang kebaca cuma
           * potongan tengahnya. Sekarang kotaknya ikut ukuran video.
           *
           * Bentuknya persegi ngikutin bentuk QR. Sempat gw bikin lebar-dan-pendek waktu
           * stikernya masih barcode batang — buat QR itu malah motong sisi atas-bawahnya.
           */
          qrbox: (lebarVideo: number, tinggiVideo: number) => {
            const sisi = Math.floor(Math.min(lebarVideo, tinggiVideo) * 0.78);
            return { width: sisi, height: sisi };
          },

          // aspectRatio 1.0 (kotak) dicabut: maksa video jadi persegi bikin sisi kiri-kanan
          // kepotong, dan sisi kiri-kanan itu justru tempat awal & akhir barcode.

          /**
           * SENGAJA false. Dia nyimpen deviceId kamera terakhir di localStorage, dan pilihan
           * simpanan itu MENANG atas `videoConstraints` di bawah — jadi HP yang pernah kepilih
           * kamera depan bakal terus balik ke kamera depan walaupun kodenya minta belakang.
           * Persis yang kejadian kemarin. Kameranya tetap bisa diganti manual lewat dropdown.
           */
          rememberLastUsedCamera: false,
          videoConstraints: { facingMode: { ideal: "environment" } },

          // Cuma format yang emang dipakai. Tiap frame di-decode ulang buat SETIAP format yang
          // didukung, jadi daftar pendek = lebih banyak percobaan per detik buat format yang
          // beneran ada di stiker.
          // QR duluan — itu yang ada di stiker sekarang. CODE_128 tetap didukung buat stiker
          // lama yang terlanjur tercetak, tapi ditaruh belakangan biar QR yang dicoba duluan
          // tiap frame.
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
          ],

          // Pakai pembaca barcode bawaan browser kalau ada (Chrome Android) — jauh lebih cepat
          // dan lebih tahan buram daripada pembaca JavaScript-nya. Kalau nggak didukung
          // (Safari iOS), otomatis balik ke cara biasa.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          if (!scannerRef.current) return;
          // Dijeda sebentar biar satu barcode nggak kebaca berkali-kali dalam sedetik —
          // kamera nembak 20 frame per detik dan barangnya masih di depan lensa.
          scannerRef.current.pause(true);
          onScanRef.current(decodedText);

          // ...lalu DILANJUTIN lagi. Sebelumnya nggak ada bagian ini, jadi kamera cuma bisa
          // baca SATU barang terus mati — buat orang gudang yang mau nembak sepuluh karung,
          // itu sama aja fiturnya nggak ada.
          setTimeout(() => {
            try { scannerRef.current?.resume(); } catch { /* keburu ditutup, nggak apa-apa */ }
          }, 1200);
        },
        () => {
          // Diabaikan. html5-qrcode manggil ini terus-terusan selama nggak ada kode di frame.
        }
      );
    } catch (e: any) {
      console.error("Scanner exception:", e);
      setError("Gagal memuat sistem kamera. Periksa izin kamera pada browser Anda (harus HTTPS atau localhost).");
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="w-full relative rounded-2xl overflow-hidden bg-white">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm font-medium border border-red-200 m-4 rounded-xl">
          {error}
        </div>
      )}
      <div id="barcode-reader" className="w-full border-none!" />
      <style dangerouslySetInnerHTML={{__html: `
        #barcode-reader { border: none !important; }
        #barcode-reader button {
          background-color: #f59e0b !important; /* amber-500 */
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          cursor: pointer;
          margin-top: 10px;
        }
        #barcode-reader a { color: #f59e0b !important; }
        /* Dropdown pilih kamera bawaan library-nya kekecilan buat jempol; di HP dibikin
           selebar layar dan setinggi target sentuh yang wajar. */
        #barcode-reader select {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 44px !important;
          padding: 8px 12px !important;
          border-radius: 10px !important;
          border: 1px solid #e7e5e4 !important;
          background-color: #fafaf9 !important;
          font-size: 15px !important;
        }
        #barcode-reader video { border-radius: 12px !important; }
      `}} />
    </div>
  );
}
