"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Pizza, Loader2, ArrowRight, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Berhasil masuk!");
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        toast.success("Pendaftaran berhasil! Silakan cek email atau hubungi admin.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan autentikasi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-3 rounded-2xl shadow-lg mb-4 ring-4 ring-amber-100">
            <Pizza className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">NEXUS CRM</h1>
          <p className="text-stone-500 font-medium tracking-wide mt-1">KITCHEN LEDGER SYSTEM</p>
        </div>

        <Card className="border-none shadow-xl shadow-stone-200/50 bg-white/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-stone-800">
              {isLogin ? "Selamat Datang Kembali" : "Buat Akun Baru"}
            </CardTitle>
            <CardDescription className="text-stone-500">
              {isLogin 
                ? "Silakan masuk untuk mengelola restoran Anda" 
                : "Daftar sekarang untuk mulai mengelola stok & absensi"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                    <Input
                      placeholder="Nama Lengkap"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-11 bg-stone-50 border-stone-200 rounded-xl focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <Input
                    type="email"
                    placeholder="Email Restoran / Pribadi"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-stone-50 border-stone-200 rounded-xl focus:ring-amber-500"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <Input
                    type="password"
                    placeholder="Kata Sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-stone-50 border-stone-200 rounded-xl focus:ring-amber-500"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-200"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    {isLogin ? "Masuk ke Sistem" : "Daftar Akun"}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t border-stone-100 bg-stone-50/50 p-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-semibold text-stone-600 hover:text-amber-600 transition-colors"
            >
              {isLogin ? "Belum punya akun? Daftar di sini" : "Sudah punya akun? Masuk di sini"}
            </button>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-stone-400 font-medium">
          &copy; 2026 NEXUS CRM. All rights reserved.
        </p>
      </div>
    </div>
  );
}
