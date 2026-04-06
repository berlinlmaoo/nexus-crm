"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Barcode from 'react-barcode';

export default function PrintBarcodePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Read ?copies=X from URL if present
  const defaultCopies = searchParams.get('copies') ? parseInt(searchParams.get('copies')!) : 1;
  const [copies, setCopies] = useState(defaultCopies > 0 ? defaultCopies : 1);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('products').select('*').eq('id', params.id).single();
      if (data) setProduct(data);
      setLoading(false);
    }
    load();
  }, [params.id, supabase]);

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

  const handlePrint = () => {
    window.print();
  };

  // Convert string code to string, as Barcode requires string
  const barcodeValue = product.code || product.id.split('-')[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6 print:m-0 print:p-0">
      
      {/* --- NON-PRINTABLE CONTROL HEADER --- */}
      <div className="flex items-center justify-between gap-4 print:hidden bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-stone-900">Cetak Barcode Thermal</h2>
            <p className="text-sm text-stone-500">Ukuran optimal: 50mm x 30mm (Zebra Printer)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col text-sm">
            <label className="font-bold text-stone-600 mb-1 text-[10px] uppercase">Jumlah Stiker</label>
            <input 
              type="number" 
              min="1"
              value={copies} 
              onChange={e => setCopies(Number(e.target.value))}
              className="w-20 px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-amber-500"
            />
          </div>
          <Button onClick={handlePrint} className="h-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-[60px] px-6">
            <Printer className="h-5 w-5 mr-2" />
            Print ({copies})
          </Button>
        </div>
      </div>

      {/* --- PRINTABLE THERMAL LABELS --- */}
      {/* We use grid to just lay them out. In print mode, page-break inside should avoid cutting across labels if printing continuous, but Zebra printers usually take the block as one page per 50x30mm frame. We will set page-break-after: always for each sticker. */}
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
          body { margin: 0; padding: 0; background: white; }
          .thermal-label {
            width: 50mm;
            height: 30mm;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: white !important;
          }
          /* Hide everything except the thermal labels */
          body > :not(.print-container) { display: none !important; }
        }
      `}} />

      <div className="print-container flex flex-wrap gap-4 print:block bg-stone-100 p-8 rounded-2xl print:bg-white print:p-0">
        {Array.from({ length: copies }).map((_, idx) => (
          <div key={idx} className="thermal-label bg-white border border-stone-300 shadow-sm print:border-none print:shadow-none w-[50mm] h-[30mm] flex flex-col items-center justify-center p-1 box-border">
            <p className="text-[10px] font-bold text-black text-center truncate w-full px-1">{product.name}</p>
            <div className="flex-1 w-full flex items-center justify-center scale-90 overflow-hidden transform origin-center">
              <Barcode 
                value={barcodeValue} 
                width={1.5} 
                height={35} 
                fontSize={12} 
                margin={0}
                displayValue={true} 
              />
            </div>
            <p className="text-[8px] text-black font-mono">Rp {product.price?.toLocaleString('id-ID')}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
