import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, ShieldAlert, History } from 'lucide-react';
import { LogAktivitas } from '../types';

interface LogsPanelProps {
  token: string;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ token }) => {
  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log =>
    log.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
    log.aktivitas.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-1.5">
            <History className="w-5 h-5 text-indigo-400" />
            Log Aktivitas Pengguna
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Daftar audit log aktivitas admin, pegawai, dan pemilik pada sistem secara real-time.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Segarkan Log
        </button>
      </div>

      <div className="relative w-full">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Cari pelaku atau detail aktivitas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[50vh] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider sticky top-0 z-10">
              <th className="p-3">Pelaku / User</th>
              <th className="p-3">Aktivitas / Operasi</th>
              <th className="p-3 text-right">Tanggal & Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
            {loading ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-slate-500">Memuat log sistem...</td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-slate-500">Tidak ada log aktivitas ditemukan.</td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                let badgeColor = 'text-indigo-400';
                if (log.id_user === 'system') badgeColor = 'text-slate-500';
                else if (log.id_user === 'user-pemilik') badgeColor = 'text-emerald-400 font-bold';

                return (
                  <tr key={log.id_log} className="hover:bg-slate-950/20">
                    <td className="p-3">
                      <span className={`text-[11px] ${badgeColor}`}>
                        {log.nama_lengkap}
                      </span>
                    </td>
                    <td className="p-3 text-slate-100 text-[11px]">{log.aktivitas}</td>
                    <td className="p-3 text-right text-slate-400 text-[10px]">
                      {new Date(log.waktu).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
