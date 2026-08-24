"use client";

import { Bell, Search, Menu, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";

interface HeaderProps {
  onMenuClick?: () => void;
  user?: any;
  restaurantName?: string;
  logoUrl?: string;
}

export function Header({ onMenuClick, user, restaurantName, logoUrl }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(user?.photo_url);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentDate = format(new Date(), "EEEE, d MMMM yyyy", { locale: id });

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router]);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(res => {
        if (res.data) setNotifs(res.data);
      })
      .catch(e => console.error("Error fetching notifications", e));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : "??";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    
    // File validation
    if (!file.type.startsWith('image/')) {
      toast.error('Gagal: Berkas harus berupa gambar (JPG/PNG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast.error('Gagal: Ukuran gambar maksimal 2MB.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Mengunggah gambar...');

    try {
      // 1. Upload ke Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error("Gagal mengunggah gambar ke Storage: " + uploadError.message);

      // 2. Dapatkan URL Publik
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // 3. Simpan ke postgres user table
      const res = await fetch('/api/users/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, photo_url: publicUrl })
      });
      if (!res.ok) throw new Error("Gagal memperbarui profil pengguna.");

      setLocalPhoto(publicUrl);
      toast.success("Foto profil berhasil diperbarui!", { id: toastId });
      router.refresh();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setIsUploading(false);
      // Reset input agar bisa upload file yang sama
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4 md:px-6 z-10 sticky top-0 shadow-sm backdrop-blur-md bg-white/80">
      {/* File input kept outside to prevent unmounting when dropdown closes */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/png, image/jpeg, image/webp" 
        onChange={handleFileChange} 
      />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="p-0 border-none w-64 max-w-[80vw]">
            <Sidebar user={user} restaurantName={restaurantName} logoUrl={logoUrl} />
          </SheetContent>
        </Sheet>
        
        <div className="hidden md:flex items-center relative group">
          <Search className="absolute left-3 h-4 w-4 text-stone-400 group-focus-within:text-amber-500 transition-colors" />
          <Input 
            placeholder="Ketik lalu 'Enter' (Pencarian Stok Utama)..." 
            className="w-80 pl-9 bg-stone-50 border-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded-full transition-all hover:bg-stone-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = e.currentTarget.value.trim();
                if (val) {
                  router.push(`/stock?q=${encodeURIComponent(val)}`);
                } else {
                  router.push(`/stock`);
                }
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:block text-xs font-bold text-stone-400 mr-4 tracking-widest uppercase">
          {currentDate}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="relative flex items-center justify-center text-stone-500 hover:text-stone-900 bg-stone-50 rounded-full h-10 w-10 overflow-hidden cursor-pointer hover:bg-stone-100 transition-colors">
              <Bell className="h-5 w-5" />
              {notifs.length > 0 && (
                <div className="absolute top-2 right-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></div>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-xl border-stone-100">
            <div className="font-bold p-3 text-stone-800 flex items-center justify-between">
              Notifikasi Baru
              {notifs.length > 0 ? (
                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full">{notifs.length} New</span>
              ) : (
                <span className="bg-stone-100 text-stone-500 text-[10px] px-2 py-0.5 rounded-full">KOSONG</span>
              )}
            </div>
            <DropdownMenuSeparator className="bg-stone-100" />
            {notifs.length === 0 ? (
              <div className="p-4 text-center">
                <Bell className="h-6 w-6 text-stone-200 mx-auto mb-2" />
                <p className="text-xs text-stone-400">Belum ada notifikasi terkini.</p>
              </div>
            ) : (
              notifs.map((n, i) => (
                <DropdownMenuItem key={n.id || i} className="p-3 focus:bg-stone-50 cursor-pointer" onClick={() => n.href && router.push(n.href)}>
                  <div className="flex flex-col w-full">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-stone-700">{n.title}</p>
                      {n.time && <span className="text-[9px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{n.time}</span>}
                    </div>
                    <p className="text-xs text-stone-500 leading-snug">{n.description}</p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-3 border-l pl-4 border-stone-200">
          <div className="hidden md:block text-right">
            <p className="text-sm font-bold text-stone-900 leading-none">{user?.name || "Anonymous User"}</p>
            <p className="text-[10px] text-amber-600 font-bold tracking-widest mt-1.5 uppercase">{user?.role || "GUEST"}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-9 w-9 border-2 border-stone-100 ring-2 ring-transparent transition-all hover:ring-amber-500 cursor-pointer shadow-sm">
                <AvatarImage src={localPhoto || user?.photo_url || undefined} alt={user?.name} className="object-cover" />
                <AvatarFallback className="bg-amber-100 text-amber-700 font-bold text-xs">{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-xl border-stone-100">
              <div className="font-normal p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-stone-500 truncate mt-1">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuItem 
                className="rounded-xl p-2.5 focus:bg-stone-100 cursor-pointer gap-2 font-medium disabled:opacity-50" 
                onClick={(e) => {
                  e.preventDefault(); 
                  if (!isUploading) {
                    // Beri sedikit jeda agar dropdown menu selesai memproses event close
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }
                }}
                disabled={isUploading}
              >
                <Avatar className="h-5 w-5 mr-1" >
                  <AvatarFallback className="bg-stone-200" />
                </Avatar>
                {isUploading ? "Mengunggah..." : "Ubah Foto Profil"}
              </DropdownMenuItem>
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
