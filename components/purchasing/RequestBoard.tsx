"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle, CheckSquare, FileText, Loader2, Plus, Square, ShoppingCart, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { segarkanData } from "@/app/actions";

export type Request = {
  id: string;
  request_number: string;
  quantity: number;
  estimated_price: number | null;
  urgency: string;
  notes: string | null;
  department: string | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
  products: { id: string; code: string; name: string; unit: string; current_stock: number; min_stock: number } | null;
  requester: { id: string; name: string; role: string } | null;
  po: { id: string; po_number: string; status: string } | null;
};

/** Kolom papan = tahapan hidup sebuah permintaan, bukan kategori barang. */
const KOLOM = [
  { key: "BARU", judul: "Diajukan", warna: "border-amber-200 bg-amber-50/60", teks: "text-amber-900" },
  { key: "DIPROSES", judul: "Jadi PO", warna: "border-emerald-200 bg-emerald-50/60", teks: "text-emerald-900" },
  { key: "SELESAI", judul: "Ditolak / Dibatalkan", warna: "border-stone-200 bg-stone-100/60", teks: "text-stone-700" },
] as const;

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

/**
 * Papan Purchase Request.
 *
 * Yang bisa dicentang CUMA kartu di kolom "Diajukan", dan itu bukan pembatasan sewenang-wenang:
 * request yang udah jadi PO atau udah ditolak nggak punya arti kalau di-PO-in lagi. Jadi
 * daripada nampilin centang yang bakal ditolak server, centangnya emang nggak ada di sana.
 */
export function RequestBoard({
  requests,
  bisaNgePO,
  bisaNolak,
  meId,
}: {
  requests: Request[];
  bisaNgePO: boolean;
  bisaNolak: boolean;
  meId: string | null;
}) {
  const router = useRouter();
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [sibuk, setSibuk] = useState(false);

  const perKolom = useMemo(() => {
    const map: Record<string, Request[]> = { BARU: [], DIPROSES: [], SELESAI: [] };
    requests.forEach((r) => {
      if (r.status === "BARU") map.BARU.push(r);
      else if (r.status === "DIPROSES") map.DIPROSES.push(r);
      else map.SELESAI.push(r);
    });
    return map;
  }, [requests]);

  const bisaDicentang = perKolom.BARU;
  const semuaTercentang = bisaDicentang.length > 0 && dipilih.size === bisaDicentang.length;

  const toggle = (id: string) =>
    setDipilih((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSemua = () =>
    setDipilih(semuaTercentang ? new Set() : new Set(bisaDicentang.map((r) => r.id)));

  const totalDipilih = bisaDicentang
    .filter((r) => dipilih.has(r.id))
    .reduce((sum, r) => sum + (r.estimated_price ?? 0) * r.quantity, 0);

  const jadiinPO = async () => {
    if (dipilih.size === 0 || sibuk) return;
    setSibuk(true);
    try {
      const res = await fetch("/api/purchasing/from-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_ids: Array.from(dipilih) }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal bikin PO", { duration: 8000 });
        return;
      }
      const d = json.data ?? {};
      toast.success(`${d.po_number} dibuat dari ${d.items} request. Nunggu persetujuan Owner.`);
      setDipilih(new Set());
      await segarkanData(["/purchase-requests", "/purchasing"]);
      if (d.po_id) router.push(`/purchasing/${d.po_id}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Nggak bisa nyambung ke server");
    } finally {
      setSibuk(false);
    }
  };

  const ubahRequest = async (r: Request, aksi: "tolak" | "batal") => {
    if (sibuk) return;
    let alasan = "";
    if (aksi === "tolak") {
      alasan = (prompt(`Kenapa ${r.request_number} ditolak?`) || "").trim();
      // Alasannya wajib — yang ngajuin harus tahu kenapa, kalau nggak dia bakal ngajuin barang
      // yang sama lagi minggu depan.
      if (!alasan) return;
    }
    setSibuk(true);
    try {
      const res = await fetch(`/api/purchase-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, alasan }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Gagal memperbarui request");
        return;
      }
      toast.success(aksi === "tolak" ? `${r.request_number} ditolak` : `${r.request_number} dibatalkan`);
      setDipilih((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
      await segarkanData(["/purchase-requests"]);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Nggak bisa nyambung ke server");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Baris aksi borongan. Muncul cuma waktu ada yang dicentang, biar nggak jadi bar kosong
          yang selalu nongkrong di layar. */}
      {bisaNgePO && dipilih.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-lg">
          <div className="min-w-0 flex-1">
            <p className="font-black text-stone-900">{dipilih.size} request dipilih</p>
            <p className="text-sm text-stone-500">
              Perkiraan total {rupiah(totalDipilih)} &middot; bakal jadi satu PO yang nunggu persetujuan Owner
            </p>
          </div>
          <Button variant="ghost" onClick={() => setDipilih(new Set())} className="font-bold text-stone-500">
            Batal pilih
          </Button>
          <Button
            onClick={jadiinPO}
            disabled={sibuk}
            className="h-12 px-6 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
          >
            {sibuk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
            Jadikan 1 Purchase Order
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {KOLOM.map((kol) => {
          const isi = perKolom[kol.key];
          return (
            <div key={kol.key} className={cn("rounded-2xl border p-4", kol.warna)}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className={cn("font-black tracking-tight", kol.teks)}>
                  {kol.judul}
                  <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{isi.length}</span>
                </h3>
                {kol.key === "BARU" && bisaNgePO && isi.length > 0 && (
                  <button
                    onClick={toggleSemua}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-amber-900 hover:bg-white/70"
                  >
                    {semuaTercentang ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                    {semuaTercentang ? "Lepas semua" : "Pilih semua"}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {isi.length === 0 && (
                  <p className="rounded-xl border border-dashed border-stone-300 bg-white/50 px-4 py-8 text-center text-sm text-stone-500">
                    {kol.key === "BARU" ? "Belum ada pengajuan baru." : "Kosong."}
                  </p>
                )}

                {isi.map((r) => {
                  const tercentang = dipilih.has(r.id);
                  const bisaPilih = kol.key === "BARU" && bisaNgePO;
                  const kritis = r.products && r.products.current_stock <= r.products.min_stock;

                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl border bg-white p-4 shadow-sm transition",
                        tercentang ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-stone-200"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {bisaPilih && (
                          <button
                            onClick={() => toggle(r.id)}
                            aria-label={tercentang ? `Lepas ${r.request_number}` : `Pilih ${r.request_number}`}
                            className="mt-0.5 shrink-0 text-stone-400 hover:text-emerald-600"
                          >
                            {tercentang
                              ? <CheckSquare className="h-5 w-5 text-emerald-600" />
                              : <Square className="h-5 w-5" />}
                          </button>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-stone-400">{r.request_number}</span>
                            {r.urgency === "URGENT" && (
                              <Badge className="bg-rose-100 text-rose-700 border-transparent text-[10px] uppercase tracking-wider">
                                <AlertTriangle className="mr-1 h-3 w-3" /> Urgent
                              </Badge>
                            )}
                            {r.department && (
                              <Badge variant="secondary" className="bg-stone-100 text-stone-600 text-[10px]">
                                {r.department}
                              </Badge>
                            )}
                          </div>

                          <p className="mt-1 font-bold leading-tight text-stone-900">
                            {r.products?.name ?? "(barang terhapus)"}
                          </p>
                          <p className="text-sm text-stone-600">
                            <span className="font-black text-stone-900">{r.quantity}</span> {r.products?.unit}
                            {r.estimated_price != null && (
                              <span className="text-stone-400"> &middot; ~{rupiah(r.estimated_price * r.quantity)}</span>
                            )}
                          </p>

                          {kritis && (
                            <p className="mt-1 text-[11px] font-bold text-rose-600">
                              Stok sekarang {r.products?.current_stock} {r.products?.unit} — di bawah batas minimum
                            </p>
                          )}

                          {r.notes && <p className="mt-2 text-xs italic text-stone-500">&ldquo;{r.notes}&rdquo;</p>}

                          {r.reject_reason && (
                            <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
                              Ditolak: {r.reject_reason}
                            </p>
                          )}

                          {r.po && (
                            <Link
                              href={`/purchasing/${r.po.id}`}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                            >
                              <FileText className="h-3 w-3" /> {r.po.po_number}
                            </Link>
                          )}

                          <p className="mt-2 text-[11px] text-stone-400">
                            {r.requester?.name ?? "akun terhapus"} &middot;{" "}
                            {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </p>

                          {kol.key === "BARU" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {bisaNolak && (
                                <Button
                                  variant="ghost" size="sm" disabled={sibuk}
                                  onClick={() => ubahRequest(r, "tolak")}
                                  className="h-8 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                >
                                  <X className="mr-1 h-3 w-3" /> Tolak
                                </Button>
                              )}
                              {r.requester?.id === meId && (
                                <Button
                                  variant="ghost" size="sm" disabled={sibuk}
                                  onClick={() => ubahRequest(r, "batal")}
                                  className="h-8 px-2 text-xs font-bold text-stone-500 hover:bg-stone-100"
                                >
                                  Batalin
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/purchase-requests/new" className="lg:hidden block">
        <Button className="w-full h-12 font-bold bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="h-4 w-4 mr-2" /> Ajukan Request
        </Button>
      </Link>
    </div>
  );
}
