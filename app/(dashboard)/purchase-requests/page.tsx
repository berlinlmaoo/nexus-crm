import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { RequestBoard, type Request } from "@/components/purchasing/RequestBoard";

export const dynamic = 'force-dynamic';

export default async function PurchaseRequestPage() {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = auth?.user
    ? await supabase.from("users").select("id, role").eq("id", auth.user.id).single()
    : { data: null as any };

  const { data } = await supabase
    .from("purchase_requests")
    .select(`
      id, request_number, quantity, estimated_price, urgency, notes, department, status,
      reject_reason, po_id, created_at,
      products:product_id (id, code, name, unit, current_stock, min_stock),
      requester:requester_id (id, name, role),
      po:po_id (id, po_number, status)
    `)
    .order("created_at", { ascending: false });

  const role = profile?.role ?? "";
  const bisaNgePO = role === "OWNER" || role === "MANAGER";

  const menunggu = (data || []).filter((r: any) => r.status === "BARU").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Purchase Request</h2>
          <p className="text-stone-500 mt-1">
            Tiap head ngajuin kebutuhan divisinya di sini. Manager atau Owner yang milih mana
            yang jadi pesanan.
          </p>
        </div>
        <Link href="/purchase-requests/new">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-500/20">
            <Plus className="h-4 w-4 mr-2" />
            Ajukan Request
          </Button>
        </Link>
      </div>

      {menunggu > 0 && bisaNgePO && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="font-bold text-amber-900">{menunggu} pengajuan nunggu diputusin</p>
          <p className="mt-0.5 text-sm text-amber-800">
            Centang yang mau dibeli — beberapa atau semua sekaligus — terus jadiin satu PO.
          </p>
        </div>
      )}

      {(data || []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-stone-100">
            <FileText className="h-7 w-7 text-stone-400" />
          </div>
          <h3 className="text-xl font-black text-stone-900">Belum ada pengajuan</h3>
          <p className="mx-auto mt-2 max-w-md text-stone-500">
            Pengadaan mulai dari sini: tiap divisi ngajuin apa yang dibutuhin, baru dipilih mana
            yang jadi pesanan.
          </p>
          <Link href="/purchase-requests/new" className="mt-6 inline-block">
            <Button className="h-12 px-8 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Ajukan Request Pertama
            </Button>
          </Link>
        </div>
      ) : (
        <RequestBoard
          requests={(data || []) as unknown as Request[]}
          bisaNgePO={bisaNgePO}
          bisaNolak={bisaNgePO}
          meId={profile?.id ?? null}
        />
      )}
    </div>
  );
}
