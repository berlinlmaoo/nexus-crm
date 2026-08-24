"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, Clock, FileText, Loader2, PackagePlus, Printer, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { segarkanData } from "@/app/actions";

const STATUS: Record<string, { label: string; kelas: string; icon: any }> = {
  PENDING_MANAGER: { label: "Nunggu persetujuan", kelas: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
  PENDING_OWNER:   { label: "Nunggu persetujuan Owner", kelas: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
  APPROVED:        { label: "Disetujui — nunggu barang dateng", kelas: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  REJECTED:        { label: "Ditolak", kelas: "bg-rose-50 text-rose-800 border-rose-200", icon: XCircle },
  FULFILLED:       { label: "Barang udah dateng semua", kelas: "bg-stone-100 text-stone-700 border-stone-200", icon: CheckCircle2 },
};

const rupiah = (n: number) => `Rp ${(n || 0).toLocaleString("id-ID")}`;

/**
 * Detail satu Purchase Order.
 *
 * Ditulis ulang buat PO yang punya BANYAK baris (borongan dari beberapa purchase request).
 * Versi sebelumnya nempel ke `po.products` dan `po.quantity` — dua kolom yang sekarang kosong
 * buat PO baru, jadi halamannya bakal blank.
 *
 * Alur terima barangnya juga ganti. Dulu barang datang divalidasi dengan nembak barcode
 * BARANG-nya; sekarang stiker itu per-unit dan lahir belakangan, jadi waktu barang baru nyampe
 * belum ada yang bisa ditembak. Yang bener: isi berapa yang dateng → nomor unitnya dibikin →
 * stikernya dicetak dan ditempel → baru divalidasi di Terminal Stok.
 */
export default function PurchaseOrderDetail() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [po, setPo] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [unitPerItem, setUnitPerItem] = useState<Record<string, { dibikin: number; divalidasi: number }>>({});
  const [loading, setLoading] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [terima, setTerima] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const [{ data: profil }, { data: order }] = await Promise.all([
      auth?.user
        ? supabase.from("users").select("id, name, role").eq("id", auth.user.id).single()
        : Promise.resolve({ data: null } as any),
      supabase
        .from("purchase_orders")
        .select(`
          *,
          requester:requester_id (name, role),
          approver:approver_id (name, role),
          items:purchase_order_items (
            id, quantity, unit_price, total_price, product_id,
            products:product_id (id, code, name, unit),
            request:request_id (request_number, department)
          )
        `)
        .eq("id", params.id)
        .single(),
    ]);

    setMe(profil);
    setPo(order);

    if (order) {
      // Berapa unit yang udah dibikin & divalidasi per barang di PO ini. Dihitung dari
      // stock_units, bukan disimpan di PO — biar nggak ada dua angka yang bisa beda.
      const { data: units } = await supabase
        .from("stock_units")
        .select("product_id, status")
        .eq("po_id", order.id);

      const map: Record<string, { dibikin: number; divalidasi: number }> = {};
      (units || []).forEach((u: any) => {
        const m = (map[u.product_id] ||= { dibikin: 0, divalidasi: 0 });
        m.dibikin += 1;
        if (u.status !== "PENDING") m.divalidasi += 1;
      });
      setUnitPerItem(map);
    }
    setLoading(false);
  }, [params.id, supabase]);

  useEffect(() => { load(); }, [load]);

  const putuskan = async (setuju: boolean) => {
    if (sibuk || !po) return;
    let alasan = "";
    if (!setuju) {
      alasan = (prompt("Kenapa PO ini ditolak?") || "").trim();
      if (!alasan) return;
    }
    setSibuk(true);
    try {
      const res = await fetch("/api/purchasing/decide", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: po.id, setuju, alasan }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal memutuskan PO", { duration: 8000 });
        return;
      }
      toast.success(setuju
        ? "PO disetujui. Barangnya boleh diterima."
        : "PO ditolak. Request-nya balik ke papan.");
      await segarkanData(["/purchasing", `/purchasing/${po.id}`, "/purchase-requests"]);
      await load();
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Nggak bisa nyambung ke server");
    } finally {
      setSibuk(false);
    }
  };

  const terimaBarang = async (item: any) => {
    const jumlah = terima[item.id] || 0;
    if (jumlah < 1) return toast.error("Isi dulu berapa unit yang dateng");
    if (sibuk) return;
    setSibuk(true);
    try {
      const res = await fetch("/api/stock/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: item.product_id,
          count: jumlah,
          reference: po.po_number,
          po_id: po.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal nyatet kedatangan", { duration: 8000 });
        return;
      }
      const serials: string[] = json.data?.serials ?? [];
      toast.success(`${serials.length} nomor unit dibikin. Cetak stikernya, tempel, terus validasi.`);
      await segarkanData(["/purchasing", `/purchasing/${po.id}`, "/stock"]);
      router.push(`/stock/${item.product_id}/print?serials=${encodeURIComponent(serials.join(","))}`);
    } catch (e: any) {
      toast.error(e?.message || "Nggak bisa nyambung ke server");
    } finally {
      setSibuk(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!po) {
    return <div className="p-10 text-center font-bold text-stone-500">Purchase order nggak ketemu.</div>;
  }

  const cfg = STATUS[po.status] || STATUS.PENDING_OWNER;
  const StatusIcon = cfg.icon;
  const items = po.items || [];
  const total = po.total_amount ?? po.total_price ?? 0;
  const nungguKeputusan = po.status === "PENDING_OWNER" || po.status === "PENDING_MANAGER";
  const bolehTerima = po.status === "APPROVED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center sm:gap-4">
        <Link href="/purchasing" className="shrink-0">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-mono">{po.po_number}</h2>
          <p className="text-sm text-stone-500 mt-1">
            Diajukan {po.requester?.name ?? "—"} &middot;{" "}
            {new Date(po.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5 text-xs font-bold", cfg.kelas)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {cfg.label}
        </Badge>
      </div>

      {po.reject_reason && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
          <p className="font-bold text-rose-900">Ditolak {po.approver?.name ? `oleh ${po.approver.name}` : ""}</p>
          <p className="mt-1 text-sm text-rose-800">{po.reject_reason}</p>
        </div>
      )}

      {/* Panel keputusan Owner. Tombolnya cuma muncul buat Owner — dan server juga nolak
          yang lain, jadi ini soal nggak nampilin tombol yang bakal gagal, bukan soal keamanan. */}
      {nungguKeputusan && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5">
          <p className="font-black text-amber-900">Nunggu keputusan Owner</p>
          <p className="mt-1 text-sm text-amber-800">
            Barang belum boleh diterima sebelum PO ini disetujui. Kalau ditolak, semua request di
            dalamnya balik ke papan biar bisa diajukan ulang.
          </p>
          {me?.role === "OWNER" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => putuskan(true)} disabled={sibuk}
                className="h-11 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {sibuk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Setujui PO
              </Button>
              <Button
                onClick={() => putuskan(false)} disabled={sibuk}
                variant="ghost" className="h-11 px-6 font-bold text-rose-600 hover:bg-rose-100"
              >
                <XCircle className="h-4 w-4 mr-2" /> Tolak
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm font-bold text-amber-900">
              Cuma Owner yang bisa memutuskan.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-5 py-4">
          <h3 className="font-black text-stone-900">Isi Pesanan</h3>
          <p className="text-sm font-bold text-stone-700">{rupiah(total)}</p>
        </div>

        <div className="divide-y divide-stone-100">
          {items.length === 0 && (
            <p className="px-5 py-10 text-center text-stone-500">PO ini nggak punya baris barang.</p>
          )}

          {items.map((item: any) => {
            const u = unitPerItem[item.product_id] || { dibikin: 0, divalidasi: 0 };
            const sisa = item.quantity - u.dibikin;

            return (
              <div key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-stone-900">{item.products?.name ?? "(barang terhapus)"}</p>
                    <p className="text-xs font-mono text-stone-400">{item.products?.code}</p>
                    {item.request && (
                      <p className="mt-1 text-[11px] text-stone-500">
                        dari {item.request.request_number}
                        {item.request.department ? ` · ${item.request.department}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-stone-900">
                      {item.quantity} <span className="text-xs font-bold text-stone-400">{item.products?.unit}</span>
                    </p>
                    {item.total_price != null && (
                      <p className="text-xs text-stone-500">{rupiah(item.total_price)}</p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-stone-100 px-2 py-1 font-bold text-stone-600">
                    {u.divalidasi} masuk gudang
                  </span>
                  {u.dibikin > u.divalidasi && (
                    <span className="rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-800">
                      {u.dibikin - u.divalidasi} nunggu validasi
                    </span>
                  )}
                  {sisa > 0 && (
                    <span className="rounded-lg bg-white px-2 py-1 font-bold text-stone-500 border border-stone-200">
                      sisa {sisa} belum dateng
                    </span>
                  )}
                </div>

                {bolehTerima && sisa > 0 && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                        Yang dateng
                      </label>
                      <Input
                        inputMode="numeric"
                        value={terima[item.id] ? String(terima[item.id]) : ""}
                        onChange={(e) => {
                          const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                          setTerima((prev) => ({ ...prev, [item.id]: Number.isFinite(n) ? n : 0 }));
                        }}
                        placeholder={String(sisa)}
                        className="h-10 w-28 bg-white font-bold"
                      />
                    </div>
                    <Button
                      onClick={() => terimaBarang(item)} disabled={sibuk}
                      className="h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {sibuk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PackagePlus className="h-4 w-4 mr-2" />}
                      Buat Nomor &amp; Cetak Stiker
                    </Button>
                    <p className="text-[11px] text-emerald-800">
                      Maks {sisa}. Stok naik nanti pas stikernya divalidasi di Terminal.
                    </p>
                  </div>
                )}

                {u.dibikin > 0 && (
                  <Link
                    href={`/stock/${item.product_id}/print`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
                  >
                    <Printer className="h-3 w-3" /> Cetak ulang stiker
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {po.notes && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Catatan</p>
          <p className="mt-1 text-stone-700">{po.notes}</p>
        </div>
      )}

      <Link href="/purchase-requests" className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-stone-800">
        <FileText className="h-4 w-4" /> Lihat papan Purchase Request
      </Link>
    </div>
  );
}
