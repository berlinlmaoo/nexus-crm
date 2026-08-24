import Link from "next/link";
import { ArrowLeft, CheckCircle2, Printer, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * Barang yang nomor unitnya udah dibikin tapi belum divalidasi masuk.
 *
 * Ini pasangan wajib dari keputusan "stok baru naik setelah stikernya ditembak di Terminal".
 * Tanpa halaman ini, unit yang stikernya ketinggalan discan cuma jadi angka di spanduk kuning
 * halaman stok — kelihatan ADA masalahnya, tapi nggak kelihatan masalahnya DI MANA dan nggak
 * ada jalan buat ngeberesinnya.
 *
 * Dikelompokin per kiriman (barang + nomor PO/nota), bukan per unit satuan: yang ketinggalan
 * biasanya sekiriman, dan orang gudang mikirnya "kiriman beras kemarin belum discan", bukan
 * "BB-001-0031 sampai 0035 belum discan".
 */
export default async function PendingValidationPage() {
  const supabase = createClient();

  const { data: units } = await supabase
    .from("stock_units")
    .select(`
      id, serial, received_at, received_ref, product_id,
      products:product_id (id, code, name, unit),
      penerima:received_by (name),
      po:po_id (id, po_number)
    `)
    .eq("status", "PENDING")
    .order("received_at", { ascending: false });

  type Kiriman = {
    kunci: string;
    produk: any;
    ref: string | null;
    po: any;
    penerima: string;
    diterima: string;
    serials: string[];
  };

  const kiriman = new Map<string, Kiriman>();
  (units || []).forEach((u: any) => {
    // Tanggalnya ikut jadi kunci: dua kiriman barang sama tanpa nomor nota di hari berbeda
    // itu dua kejadian berbeda, dan nggak boleh keliatan sebagai satu tumpukan.
    const tanggal = new Date(u.received_at).toISOString().slice(0, 10);
    const kunci = `${u.product_id}|${u.received_ref ?? ""}|${tanggal}`;
    const ada = kiriman.get(kunci);
    if (ada) {
      ada.serials.push(u.serial);
    } else {
      kiriman.set(kunci, {
        kunci,
        produk: u.products,
        ref: u.received_ref,
        po: u.po,
        penerima: u.penerima?.name ?? "akun terhapus",
        diterima: u.received_at,
        serials: [u.serial],
      });
    }
  });

  const daftar = Array.from(kiriman.values()).map((k) => ({ ...k, serials: k.serials.sort() }));
  const totalUnit = (units || []).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center sm:gap-4">
        <Link href="/stock" className="shrink-0">
          <Button variant="ghost" size="icon" className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">Menunggu Validasi</h2>
          <p className="text-sm text-stone-500 mt-1">
            Nomor unitnya udah dibikin, stikernya belum ditembak di Terminal — jadi belum kehitung stok.
          </p>
        </div>
        {totalUnit > 0 && (
          <Link href="/stock/scan" className="w-full sm:w-auto">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20">
              <ScanBarcode className="h-4 w-4 mr-2" />
              Buka Terminal
            </Button>
          </Link>
        )}
      </div>

      {daftar.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-16 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-emerald-900">Nggak ada yang ketinggalan</h3>
          <p className="mx-auto mt-2 max-w-md text-emerald-800">
            Semua barang yang nomornya udah dibikin juga udah divalidasi masuk gudang.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="font-bold text-amber-900">
              {totalUnit} unit dari {daftar.length} kiriman belum divalidasi
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              Kalau stikernya ilang atau kescan-nya nggak kebaca, cetak ulang dari sini — nomornya
              tetap sama, nggak bikin unit baru.
            </p>
          </div>

          <div className="space-y-3">
            {daftar.map((k) => (
              <div key={k.kunci} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-stone-900">{k.produk?.name ?? "(barang terhapus)"}</p>
                    <p className="text-xs font-mono text-stone-400">{k.produk?.code}</p>
                    <p className="mt-1 text-[11px] text-stone-500">
                      Diterima {k.penerima} &middot;{" "}
                      {new Date(k.diterima).toLocaleString("id-ID", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black leading-none text-amber-700">{k.serials.length}</p>
                    <p className="text-[11px] font-bold text-stone-500">{k.produk?.unit}</p>
                  </div>
                </div>

                {(k.po || k.ref) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {k.po ? (
                      <Link href={`/purchasing/${k.po.id}`}>
                        <Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-200 font-mono text-[10px]">
                          {k.po.po_number}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="secondary" className="bg-stone-100 text-stone-600 font-mono text-[10px]">
                        {k.ref}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Nomornya dicetak apa adanya. Orang gudang yang lagi nyari mana yang
                    ketinggalan butuh nomornya buat dicocokin sama stiker di tangan — bukan
                    cuma dikasih tahu "ada 5 yang kurang". */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {k.serials.map((sn) => (
                    <span key={sn} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                      {sn}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/stock/${k.produk?.id}/print?serials=${encodeURIComponent(k.serials.join(","))}`}>
                    <Button variant="outline" className="font-bold border-amber-200 text-amber-700 hover:bg-amber-50">
                      <Printer className="h-4 w-4 mr-2" />
                      Cetak Ulang {k.serials.length} Stiker
                    </Button>
                  </Link>
                  <Link href="/stock/scan">
                    <Button variant="ghost" className="font-bold text-stone-600">
                      <ScanBarcode className="h-4 w-4 mr-2" />
                      Validasi
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
