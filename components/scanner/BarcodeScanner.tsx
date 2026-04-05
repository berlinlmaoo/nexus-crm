"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export default function BarcodeScanner({ onScanSuccess }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      scannerRef.current = new Html5QrcodeScanner(
        "barcode-reader",
        {
          fps: 20,
          qrbox: { width: 300, height: 150 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          // Pause scanning once successfully detected a string
          if (scannerRef.current) {
            scannerRef.current.pause(true);
            onScanSuccess(decodedText);
          }
        },
        (err) => {
          // Ignored. html5-qrcode calls this frequently when no code is found in frame.
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
  }, [onScanSuccess]);

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
      `}} />
    </div>
  );
}
