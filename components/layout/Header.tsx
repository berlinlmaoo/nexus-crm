"use client";

import { Bell, Search, Menu, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onMenuClick?: () => void;
  user?: any;
}

export function Header({ onMenuClick, user }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const currentDate = format(new Date(), "EEEE, d MMMM yyyy", { locale: id });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : "??";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4 md:px-6 z-10 sticky top-0 shadow-sm backdrop-blur-md bg-white/80">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="hidden md:flex items-center relative group">
          <Search className="absolute left-3 h-4 w-4 text-stone-400 group-focus-within:text-amber-500 transition-colors" />
          <Input 
            placeholder="Cari menu, stok, atau pesanan..." 
            className="w-80 pl-9 bg-stone-50 border-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded-full transition-all hover:bg-stone-100"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:block text-xs font-bold text-stone-400 mr-4 tracking-widest uppercase">
          {currentDate}
        </div>
        
        <Button variant="ghost" size="icon" className="relative text-stone-500 hover:text-stone-900 bg-stone-50 rounded-full">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </Button>

        <div className="flex items-center gap-3 border-l pl-4 border-stone-200">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-stone-900 leading-none">{user?.name || "Anonymous User"}</p>
            <p className="text-[10px] text-amber-600 font-bold tracking-widest mt-1.5 uppercase">{user?.role || "GUEST"}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-9 w-9 border-2 border-stone-100 ring-2 ring-transparent transition-all hover:ring-amber-500 cursor-pointer shadow-sm">
                <AvatarImage src={user?.photo_url || `https://i.pravatar.cc/150?u=${user?.id}`} alt={user?.name} />
                <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-xs">{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl border-stone-100">
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-stone-500 truncate mt-1">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-stone-100" />
              <DropdownMenuItem className="rounded-xl p-2.5 focus:bg-amber-50 focus:text-amber-700 cursor-pointer gap-2 font-medium" onClick={() => router.push('/settings')}>
                <SettingsIcon className="h-4 w-4" />
                Pengaturan Akun
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-stone-100" />
              <DropdownMenuItem 
                className="rounded-xl p-2.5 focus:bg-red-50 focus:text-red-600 cursor-pointer gap-2 font-bold text-red-500" 
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Keluar Sistem
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
