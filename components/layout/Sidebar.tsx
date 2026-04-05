"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Home, 
  Package, 
  ClipboardList, 
  Users as UsersIcon, 
  ShoppingCart, 
  TrendingUp, 
  Settings, 
  Pizza,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  user?: any;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const role = user?.role || "GUEST";

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home, roles: ["OWNER", "MANAGER"] },
    { name: "Stock Management", href: "/stock", icon: Package, roles: ["OWNER", "MANAGER", "STAFF_GUDANG", "STAFF_DAPUR"] },
    { name: "Stock Opname", href: "/opname", icon: ClipboardList, roles: ["OWNER", "MANAGER", "STAFF_GUDANG"] },
    { name: "Absensi Staff", href: "/attendance", icon: UsersIcon, roles: ["OWNER", "MANAGER", "STAFF_GUDANG", "STAFF_DAPUR"] },
    { name: "Purchase Orders", href: "/purchasing", icon: ShoppingCart, roles: ["OWNER", "MANAGER", "STAFF_GUDANG"] },
    { name: "Finance Report", href: "/report", icon: TrendingUp, roles: ["OWNER"] },
    { name: "Settings", href: "/settings", icon: Settings, roles: ["OWNER"] },
  ];

  // Filter navigation by role
  const filteredNavigation = navigation.filter(item => item.roles.includes(role));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-stone-50/50 backdrop-blur-xl">
      <div className="flex h-16 shrink-0 items-center px-6 gap-3 border-b border-stone-100">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-1.5 rounded-lg shadow-sm">
          <Pizza className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-none text-stone-900 tracking-tight">NEXUS CRM</h1>
          <p className="text-[10px] text-stone-500 font-medium tracking-widest mt-0.5">KITCHEN LEDGER</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1.5 px-4">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/50"
                    : "text-stone-500 hover:bg-stone-100/80 hover:text-stone-900"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-amber-500" : "text-stone-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="p-4 border-t border-stone-100 space-y-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200/50">
          <p className="text-[10px] font-bold text-stone-400 tracking-wider uppercase">Logged in as</p>
          <p className="text-sm font-bold text-stone-800 mt-1 truncate">{user?.name || "Anonymous"}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              role === "OWNER" ? "bg-amber-500" : role === "MANAGER" ? "bg-blue-500" : "bg-emerald-500"
            )}></div>
            <p className="text-xs text-stone-500 font-medium">{role}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
        >
          <LogOut className="h-4 w-4" />
          Keluar Sistem
        </button>
      </div>
    </div>
  );
}
