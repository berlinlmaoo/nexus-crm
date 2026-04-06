"use client";

import { useEffect, useState } from "react";
import { Users as UsersIcon, ShieldAlert, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users'); // We already have this route returning all users
      const json = await res.json();
      if (json.data) {
        setUsers(json.data);
      }
    } catch (err) {
      toast.error("Gagal memuat daftar pengguna");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string | null) => {
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/users/update-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole: newRole === "" ? null : newRole })
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error("Gagal mengubah role: " + data.error);
      } else {
        toast.success("Role berhasil diperbarui!");
        // Update local state
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole === "" ? null : newRole } : u));
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const unapprovedUsers = users.filter(u => !u.role);
  const approvedUsers = users.filter(u => !!u.role);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">User Management & Approvals</h2>
        <p className="text-stone-500 mt-1">Atur hak akses staf dan setujui pendaftaran akun baru.</p>
      </div>

      {unapprovedUsers.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-rose-100/50 p-4 border-b border-rose-200 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <h3 className="font-bold text-rose-800">Menunggu Persetujuan ({unapprovedUsers.length})</h3>
          </div>
          <div className="divide-y divide-rose-100">
            {unapprovedUsers.map(user => (
              <div key={user.id} className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/60">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <Avatar className="h-10 w-10 border border-rose-100 shadow-sm">
                    <AvatarImage src={user.photo_url || `https://i.pravatar.cc/150?u=${user.id}`} alt={user.name} className="object-cover" />
                    <AvatarFallback className="bg-rose-100 text-rose-700 font-bold">{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-stone-900">{user.name}</h4>
                    <p className="text-sm text-stone-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex w-full md:w-auto gap-3 items-center">
                  <select 
                    className="flex-1 md:w-48 h-10 px-3 bg-white border border-stone-200 focus:border-rose-500 rounded-lg outline-none cursor-pointer"
                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                    value=""
                    disabled={updatingId === user.id}
                  >
                    <option value="" disabled>Pilih Role (Approve)...</option>
                    <option value="STAFF_GUDANG">STAFF_GUDANG</option>
                    <option value="STAFF_DAPUR">STAFF_DAPUR</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                  {updatingId === user.id && <Loader2 className="w-5 h-5 animate-spin text-rose-500" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-stone-50 p-4 border-b border-stone-100 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-stone-600" />
          <h3 className="font-bold text-stone-800">Akun Aktif ({approvedUsers.length})</h3>
        </div>
        <div className="divide-y divide-stone-50">
          {approvedUsers.map(user => (
            <div key={user.id} className="p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-stone-50/50 transition-colors">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <Avatar className="h-10 w-10 border border-stone-100 shadow-sm">
                  <AvatarImage src={user.photo_url || `https://i.pravatar.cc/150?u=${user.id}`} alt={user.name} className="object-cover" />
                  <AvatarFallback className="bg-amber-100 text-amber-700 font-bold">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-bold text-stone-900">{user.name}</h4>
                  <p className="text-sm text-stone-500">{user.email}</p>
                </div>
              </div>
              <div className="flex w-full md:w-auto gap-3 items-center">
                <Badge variant="outline" className={
                  user.role === 'OWNER' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                  user.role === 'MANAGER' ? 'bg-sky-50 text-sky-700 border-sky-200' : 
                  'bg-stone-100 text-stone-600 border-stone-200'
                }>{user.role}</Badge>

                <select 
                  className="h-9 px-2 ml-2 bg-transparent border border-stone-200 text-sm focus:border-stone-400 rounded-md outline-none cursor-pointer text-stone-600 hover:bg-stone-50"
                  onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                  value={user.role}
                  disabled={updatingId === user.id}
                >
                  <option value="STAFF_GUDANG">STAFF_GUDANG</option>
                  <option value="STAFF_DAPUR">STAFF_DAPUR</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="OWNER">OWNER</option>
                  <option value="">CABUT AKSES (NULL)</option>
                </select>
                {updatingId === user.id && <Loader2 className="w-5 h-5 animate-spin text-stone-400" />}
              </div>
            </div>
          ))}
          {approvedUsers.length === 0 && (
            <div className="p-10 text-center text-stone-500">
              Belum ada akun yang di-approve.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
