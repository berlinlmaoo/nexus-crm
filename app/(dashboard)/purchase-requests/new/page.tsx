import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "@/components/purchasing/RequestForm";

export const dynamic = 'force-dynamic';

export default async function NewRequestPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("id, code, name, unit, current_stock, min_stock, price")
    .eq("is_active", true)
    .order("code");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/purchase-requests" className="shrink-0">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">Ajukan Request</h2>
          <p className="text-sm text-stone-500 mt-1">Apa yang divisi kamu butuhin? Ini permintaan, belum pesanan.</p>
        </div>
      </div>

      <RequestForm products={data || []} />
    </div>
  );
}
