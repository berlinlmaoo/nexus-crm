"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { CopyPlus, CopyMinus, Trash2, PenLine, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// We removed direct supabase imports because we will use a secure API Route.

export function StockUpdateForm({ product }: { product: any }) {
  const router = useRouter();
  return (
    <div className="bg-rose-50 rounded-2xl shadow-sm border border-rose-200 overflow-hidden mt-6 p-6 md:p-10 text-center flex flex-col items-center justify-center">
      <div className="bg-rose-100 p-4 rounded-full mb-4">
        <CopyMinus className="h-8 w-8 text-rose-500" />
      </div>
      <h3 className="text-xl font-bold text-stone-900 mb-2">Input Manual Dinonaktifkan</h3>
      <p className="text-stone-600 max-w-md mx-auto mb-6">
        Sesuai dengan kebijakan baru, seluruh proses penerimaan, pengeluaran, dan penyesuaian stok hanya dapat dilakukan melalui **Validasi Scanner Barcode / QR**.
      </p>
      
      <Button onClick={() => router.push('/stock/scan')} className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
        Buka Terminal Scanner
      </Button>
    </div>
  );
}
