"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ClipboardList, Search, ChevronDown, ChevronUp, 
  CheckCircle2, AlertCircle, Loader2, ArrowLeft, Send 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  price: number;
};

type OpnameItem = Product & {
  physical_count: number | '';
};

export default function NewOpnamePage() {
  const router = useRouter();
  const [products, setProducts] = useState<OpnameItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [showOnlyDiscrepancy, setShowOnlyDiscrepancy] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, uRes] = await Promise.all([
          fetch('/api/opname'),
          fetch('/api/users'),
        ]);
        const [pJson, uJson] = await Promise.all([pRes.json(), uRes.json()]);
        if (pJson.data) {
          setProducts(pJson.data.map((p: Product) => ({ ...p, physical_count: '' })));
        }
        if (uJson.data) setUsers(uJson.data);
      } catch (e) {
        toast.error("Gagal memuat data produk.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category))).sort();
    return ['Semua', ...cats];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.code.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Semua' || p.category === filterCategory;
      const matchDiscrepancy = !showOnlyDiscrepancy || 
                               (p.physical_count !== '' && p.physical_count !== p.current_stock);
      return matchSearch && matchCat && matchDiscrepancy;
    });
  }, [products, search, filterCategory, showOnlyDiscrepancy]);

  const stats = useMemo(() => {
    const filled = products.filter(p => p.physical_count !== '');
    const discrepancies = filled.filter(p => p.physical_count !== p.current_stock);
    const totalSelisih = discrepancies.reduce((sum, p) => 
      sum + Math.abs((p.physical_count as number) - p.current_stock), 0);
    return { filled: filled.length, total: products.length, discrepancies: discrepancies.length, totalSelisih };
  }, [products]);

  const updateCount = (id: string, value: string) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, physical_count: value === '' ? '' : Math.max(0, Number(value)) } : p
    ));
  };

  const handleSubmit = async () => {
    if (stats.filled === 0) {
      toast.warning("Masukkan minimal 1 hitung fisik sebelum submit.");
      return;
    }
    setSubmitting(true);
    try {
      const items = products
        .filter(p => p.physical_count !== '')
        .map(p => ({
          product_id: p.id,
          system_stock: p.current_stock,
          physical_count: Number(p.physical_count),
        }));

      const res = await fetch('/api/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, user_id: selectedUser || null, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Error: " + json.error);
      } else {
        setResult(json);
        setDone(true);
        toast.success(json.message);
      }
    } catch (e: any) {
      toast.error("Network error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-500 font-medium">Memuat daftar produk untuk opname...</p>
      </div>
    );
  }

  if (done && result) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="mx-auto w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black text-stone-800">Opname Berhasil!</h2>
        <p className="text-stone-500">{result.message}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-emerald-700">Item Disesuaikan</p>
            <p className="text-4xl font-black text-emerald-600 mt-1">{result.adjusted}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-amber-700">Dihitung</p>
            <p className="text-4xl font-black text-amber-600 mt-1">{stats.filled}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { router.refresh(); router.push('/opname'); }} variant="outline" className="flex-1">
            Riwayat Opname
          </Button>
          <Button onClick={() => { router.refresh(); router.push('/stock'); }} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold">
            Lihat Stok
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-stone-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Stock Opname Baru</h2>
            <p className="text-stone-500 mt-1">Masukkan jumlah fisik aktual untuk setiap produk.</p>
          </div>
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={submitting || stats.filled === 0}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 shadow-md shadow-amber-500/20 h-11"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          {submitting ? 'Menyimpan...' : `Submit Opname (${stats.filled} item)`}
        </Button>
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Produk</p>
          <p className="text-2xl font-black text-stone-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">Sudah Dihitung</p>
          <p className="text-2xl font-black text-sky-700 mt-1">{stats.filled}</p>
        </div>
        <div className={`${stats.discrepancies > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-4 shadow-sm`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${stats.discrepancies > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Selisih Ditemukan</p>
          <p className={`text-2xl font-black mt-1 ${stats.discrepancies > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{stats.discrepancies}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Total Unit Selisih</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{stats.totalSelisih}</p>
        </div>
      </div>

      {/* Filters + Meta */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
              placeholder="Cari nama atau kode produk..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-10 px-4 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-700 outline-none focus:border-amber-500"
          >
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="flex-1 h-10 px-4 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-700 outline-none focus:border-amber-500"
            >
              <option value="">-- Petugas Opname --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnlyDiscrepancy(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all ${showOnlyDiscrepancy ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'}`}
          >
            <AlertCircle className="h-4 w-4" />
            Tampilkan selisih saja {showOnlyDiscrepancy && `(${stats.discrepancies})`}
          </button>
          <Input 
            placeholder="Catatan opname..." 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="flex-1"
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Produk</th>
                <th className="text-left py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Kategori</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Stok Sistem</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider w-36">Hitung Fisik</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Selisih</th>
                <th className="text-center py-3 px-4 font-bold text-stone-500 text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map((product, i) => {
                const hasCount = product.physical_count !== '';
                const count = hasCount ? Number(product.physical_count) : null;
                const diff = count !== null ? count - product.current_stock : null;
                const isMatch = diff === 0;
                const isShort = diff !== null && diff < 0;
                const isExcess = diff !== null && diff > 0;

                return (
                  <tr key={product.id} className={`hover:bg-stone-50/50 transition-colors ${hasCount && !isMatch ? (isShort ? 'bg-rose-50/30' : 'bg-sky-50/30') : ''}`}>
                    <td className="py-3 px-4">
                      <p className="font-bold text-stone-800">{product.name}</p>
                      <p className="text-xs text-stone-400 font-mono">{product.code}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs bg-stone-50 text-stone-600 border-stone-200">
                        {product.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-stone-800 text-base">{product.current_stock}</span>
                      <span className="text-xs text-stone-400 ml-1">{product.unit}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        type="number"
                        min="0"
                        value={product.physical_count}
                        onChange={e => updateCount(product.id, e.target.value)}
                        placeholder="—"
                        className={`text-center font-bold text-base h-10 ${
                          hasCount && isMatch ? 'border-emerald-300 bg-emerald-50 text-emerald-800 focus:ring-emerald-200' :
                          hasCount && isShort ? 'border-rose-300 bg-rose-50 text-rose-800 focus:ring-rose-200' :
                          hasCount && isExcess ? 'border-sky-300 bg-sky-50 text-sky-800 focus:ring-sky-200' :
                          'border-stone-200'
                        }`}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {diff !== null ? (
                        <span className={`font-black text-lg ${isMatch ? 'text-emerald-600' : isShort ? 'text-rose-600' : 'text-sky-600'}`}>
                          {isExcess ? '+' : ''}{diff}
                        </span>
                      ) : (
                        <span className="text-stone-300 font-bold">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!hasCount ? (
                        <span className="text-xs text-stone-300 font-bold">BELUM</span>
                      ) : isMatch ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">✅ SESUAI</Badge>
                      ) : isShort ? (
                        <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">⚠ KURANG</Badge>
                      ) : (
                        <Badge className="bg-sky-100 text-sky-700 border-0 text-xs">↑ LEBIH</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <ClipboardList className="h-10 w-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-400 font-medium">Tidak ada produk yang cocok dengan filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
