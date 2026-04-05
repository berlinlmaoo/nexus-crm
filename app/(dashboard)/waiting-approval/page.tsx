"use client";

import { Pizza, Clock, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function WaitingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-amber-600 text-white p-3 rounded-2xl shadow-lg mb-4">
            <Pizza className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight italic">NEXUS CRM</h1>
        </div>

        <Card className="border-none shadow-2xl shadow-stone-200/50 rounded-3xl overflow-hidden bg-white">
          <CardHeader className="text-center pt-10">
            <div className="mx-auto bg-amber-50 text-amber-600 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 ring-8 ring-amber-50/50">
              <Clock className="h-10 w-10 animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold text-stone-800">Menunggu Persetujuan Admin</CardTitle>
            <CardDescription className="text-stone-500 max-w-sm mx-auto mt-2">
              Akun Anda berhasil terdaftar! Saat ini Admin sedang memverifikasi identitas dan menentukan role akses Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-10">
            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 text-left">
              <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                Apa langkah selanjutnya?
              </h3>
              <ul className="space-y-3 text-sm text-stone-600">
                <li className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex flex-shrink-0 items-center justify-center font-bold text-[10px]">1</div>
                  <span>Hubungi Manager atau Owner restoran Anda.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex flex-shrink-0 items-center justify-center font-bold text-[10px]">2</div>
                  <span>Admin akan memberikan Role (Owner/Manager/Staff) pada akun Anda.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex flex-shrink-0 items-center justify-center font-bold text-[10px]">3</div>
                  <span>Refresh halaman ini setelah dikonfirmasi oleh Admin.</span>
                </li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 p-6 bg-stone-50/50 border-t border-stone-100">
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-stone-600 border-stone-200"
              onClick={() => location.reload()}
            >
              Cek Status Sekarang
            </Button>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Keluar Akun
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-stone-400 mt-8 font-medium italic">
          NEXUS CRM | Kitchen Ledger Productivity System
        </p>
      </div>
    </div>
  );
}
