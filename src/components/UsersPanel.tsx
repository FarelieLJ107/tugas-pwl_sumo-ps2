import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  X, 
  Check, 
  ShieldAlert,
  UserCheck,
  Key
} from 'lucide-react';
import { User, UserRole } from '../types';

interface UsersPanelProps {
  token: string;
  currentUser: { id: string; role: string } | null;
}

export const UsersPanel: React.FC<UsersPanelProps> = ({ token, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');

  // Modal control
  const [showModal, setShowModal] = useState<'none' | 'add' | 'edit'>('none');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [role, setRole] = useState<UserRole>('pegawai');
  const [password, setPassword] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data user.');
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setUsername('');
    setNamaLengkap('');
    setRole('pegawai');
    setPassword('');
    setError('');
    setShowModal('add');
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setUsername(user.username);
    setNamaLengkap(user.nama_lengkap);
    setRole(user.role);
    setPassword(''); // blank means do not update
    setError('');
    setShowModal('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!username || !namaLengkap || !role) {
      setError('Username, Nama Lengkap, dan Role wajib diisi.');
      return;
    }

    if (showModal === 'add' && !password) {
      setError('Password wajib diisi untuk pegawai baru.');
      return;
    }

    const payload = {
      username: username.trim(),
      nama_lengkap: namaLengkap.trim(),
      role,
      password: password ? password.trim() : undefined
    };

    try {
      let res;
      if (showModal === 'add') {
        res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/users/${selectedUser?.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Terjadi kesalahan sistem.');

      setSuccessMsg(showModal === 'add' ? 'Pegawai baru berhasil ditambahkan!' : 'Profil pegawai berhasil diperbarui!');
      setShowModal('none');
      fetchUsers();
      
      // Clear success after 3s
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Aksi dilarang: Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
      return;
    }

    if (user.username === 'pemilik' && user.role === 'pemilik') {
      alert('Aksi dilarang: Akun Pemilik utama sistem tidak dapat dihapus untuk mencegah kuncian sistem.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus akun pegawai "${user.nama_lengkap}"?\nSemua log aktivitas akan tetap dipertahankan.`)) {
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus user.');

      setSuccessMsg(`Akun "${user.nama_lengkap}" berhasil dihapus.`);
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(user => 
    user.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Manajemen Pegawai & Akun
          </h2>
          <p className="text-xs text-slate-400">
            Daftarkan pegawai baru, ubah rincian login, atur hak akses pemilik/pegawai, dan amankan kredensial kasir.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-950/40 flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Tambah Pegawai
        </button>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-semibold"
        >
          {successMsg}
        </motion.div>
      )}

      {/* Search Input */}
      <div className="relative w-full">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pegawai berdasarkan nama atau username..."
          className="w-full bg-slate-900 border border-slate-850 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500 font-mono text-xs">
          Memuat daftar pegawai...
        </div>
      ) : error && showModal === 'none' ? (
        <div className="p-4 bg-rose-950 border border-rose-800 text-rose-300 rounded-2xl text-xs">
          {error}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="p-4">ID Akun</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Nama Lengkap</th>
                  <th className="p-4">Role Akses</th>
                  <th className="p-4">Terdaftar Sejak</th>
                  <th className="p-4 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Belum ada pegawai atau hasil pencarian kosong.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="p-4 font-mono text-slate-500 text-[11px]">
                        {user.id}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-200">
                        {user.username}
                      </td>
                      <td className="p-4 font-bold font-display text-white text-sm">
                        {user.nama_lengkap}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          user.role === 'pemilik' 
                            ? 'bg-rose-950/40 border-rose-800 text-rose-400' 
                            : 'bg-indigo-950/40 border-indigo-800 text-indigo-400'
                        }`}>
                          {user.role === 'pemilik' ? 'Pemilik' : 'Pegawai'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-400">
                        {new Date(user.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-300 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Pegawai"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-rose-400 hover:text-rose-300 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
                            disabled={user.id === currentUser?.id}
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRUD USER MODAL */}
      <AnimatePresence>
        {showModal !== 'none' && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-lg font-bold text-white font-display flex items-center gap-1.5">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  {showModal === 'add' ? 'Tambah Akun Pegawai' : 'Edit Akun Pegawai'}
                </h3>
                <button
                  onClick={() => setShowModal('none')}
                  className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs mb-3 font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Username Login</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: agus_kasir"
                    disabled={showModal === 'edit' && username === 'pemilik'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    placeholder="Contoh: Agus Pratama"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Role Akses</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={showModal === 'edit' && selectedUser?.id === currentUser?.id}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="pegawai">Pegawai (Kasir / Staff)</option>
                    <option value="pemilik">Pemilik (Full Admin & Laporan)</option>
                  </select>
                  {showModal === 'edit' && selectedUser?.id === currentUser?.id && (
                    <span className="text-[10px] text-slate-500 block mt-1">Anda tidak dapat mengubah hak akses akun Anda sendiri yang sedang aktif.</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Password {showModal === 'edit' ? '(Kosongkan jika tidak diubah)' : 'Login'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                      <Key className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={showModal === 'edit' ? "Masukkan password baru jika ingin mengubah" : "Masukkan password login"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      required={showModal === 'add'}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal('none')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Simpan Akun
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
