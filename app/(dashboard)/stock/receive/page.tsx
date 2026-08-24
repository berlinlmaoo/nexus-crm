import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ReceiveForm } from "@/components/stock/ReceiveForm";

export const dynamic = 'force-dynamic';

export default async function ReceiveStockPage() {
  const supabase = createClient();

  // PO yang udah disetujui tapi barangnya belum lengkap dateng. Yang ditawarin cuma ini —
  // PO yang belum disetujui belum boleh jadi dasar barang masuk.
  const [{ data }, { data: po }] = await Promise.all([
    supabase.from("products").select("id, code, name, unit").eq("is_active", true).order("code"),
    supabase
      .from("purchase_orders")
      .select("id, po_number, quantity, product_id, status")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false }),
  ]);

  // Sisa tiap PO dihitung dari unit yang udah pernah dibikin buat PO itu (yang masih PENDING
  // pun ikut dihitung — stikernya udah terlanjur dicetak, jadi jatahnya udah kepakai).
  const { data: unitPo } = await supabase.from("stock_units").select("po_id, status");
  const kepakai: Record<string, number> = {};
  (unitPo || []).forEach((u: any) => {
    if (u.po_id) kepakai[u.po_id] = (kepakai[u.po_id] || 0) + 1;
  });

  const poList = (po || [])
    .map((x: any) => ({ ...x, sisa: x.quantity - (kepakai[x.id] || 0) }))
    .filter((x: any) => x.sisa > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/stock">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Barang Masuk</h2>
          <p className="text-sm text-stone-500 mt-1">Catat kedatangan barang dan cetak stiker bernomor buat tiap unitnya.</p>
        </div>
      </div>

      <ReceiveForm products={data || []} purchaseOrders={poList} />
    </div>
  );
}
