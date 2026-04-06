"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";

export default function DashboardSearch({ defaultQuery, placeholder }: { defaultQuery?: string, placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultQuery || "");

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 400); // 400ms debounce

    return () => clearTimeout(timeout);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isPending ? 'text-amber-500 animate-pulse' : 'text-stone-400'}`} />
      <Input 
        placeholder={placeholder || "Cari data..."} 
        className="pl-9 bg-white border-stone-200 focus-visible:ring-emerald-500"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
