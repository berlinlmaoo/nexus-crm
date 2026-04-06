"use client";

import { Filter } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function AttendanceFilter({ currentFilter }: { currentFilter?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== "ALL") {
      params.set("filter", val);
    } else {
      params.delete("filter");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="relative inline-block">
      <select 
        className="appearance-none h-10 w-44 pl-10 pr-4 rounded-md border border-stone-200 bg-white text-sm font-semibold text-stone-700 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
        value={currentFilter || "ALL"}
        onChange={(e) => handleFilterChange(e.target.value)}
        disabled={isPending}
      >
        <option value="ALL">Semua Kehadiran</option>
        <option value="ONTIME">Tepat Waktu</option>
        <option value="LATE">Terlambat</option>
        <option value="OUT_OF_RANGE">Di Luar Jangkauan</option>
      </select>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Filter className={`h-4 w-4 ${isPending ? 'text-emerald-500 animate-spin' : 'text-stone-400'}`} />
      </div>
    </div>
  );
}
