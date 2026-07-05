import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  TrendingUp, 
  X, 
  Check, 
  BarChart4,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  Cell
} from 'recharts';
import { Inventori } from '../types';
import Swal from 'sweetalert2';

interface InventoryPanelProps {
  token: string;
  onRefreshTrigger?: () => void;
}

const CustomInventoryTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isLow = payload[1]?.payload?.isLow;
    return (
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl text-[11px] space-y-1.5 font-mono">
        <p className="font-bold text-slate-200 font-display text-[11px] mb-1">{label}</p>
        <div className="flex justify-between items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-slate-400">Total Terjual:</span>
          </span>
          <span className="font-bold text-indigo-400">
            {payload[0]?.value} porsi/pcs
          </span>
        </div>
        <div className="flex justify-between items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-slate-400">Sisa Stok:</span>
          </span>
          <span className={`font-bold ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
            {payload[1]?.value} pcs {isLow && '(Warning!)'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ token, onRefreshTrigger }) => {
  const [items, setItems] = useState<Inventori[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Modals
  const [showModal, setShowModal] = useState<'none' | 'add' | 'edit'>('none');
  const [selectedItem, setSelectedItem] = useState<Inventori | null>(null);

  // Form Fields
  const [namaBarang, setNamaBarang] = useState('');
  const [kategori, setKategori] = useState('Makanan');
  const [statusItem, setStatusItem] = useState('baik');
  const [stokSaatIni, setStokSaatIni] = useState(0);
  const [safetyStock, setSafetyStock] = useState(0);
  const [hargaGrosir, setHargaGrosir] = useState(0);
  const [hargaEceran, setHargaEceran] = useState(0);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/inventori', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat inventori.');
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleOpenAdd = () => {
    setNamaBarang('');
    setKategori('Makanan');
    setStatusItem('baik');
    setStokSaatIni(10);
    setSafetyStock(5);
    setHargaGrosir(1000);
    setHargaEceran(2000);
    setShowModal('add');
  };

  const handleOpenEdit = (item: Inventori) => {
    setSelectedItem(item);
    setNamaBarang(item.nama_barang);
    setKategori(item.kategori || 'Makanan');
    setStatusItem(item.status || 'baik');
    setStokSaatIni(item.stok_saat_ini);
    setSafetyStock(item.safety_stock);
    setHargaGrosir(item.harga_grosir);
    setHargaEceran(item.harga_eceran);
    setShowModal('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaBarang || stokSaatIni < 0 || safetyStock < 0 || hargaGrosir < 0 || hargaEceran < 0) {
      setError('Mohon isi semua data dengan valid.');
      return;
    }

    const payload = {
      nama_barang: namaBarang,
      stok_saat_ini: stokSaatIni,
      safety_stock: safetyStock,
      harga_grosir: hargaGrosir,
      harga_eceran: hargaEceran,
      kategori: kategori,
      status: statusItem
    };

    try {
      let res;
      if (showModal === 'add') {
        res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/inventori', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/inventori/${selectedItem?.id_barang}`, {
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

      setShowModal('none');
      fetchInventory();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${name}" dari inventori?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/inventori/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus barang.');

      fetchInventory();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredItems = items.filter(item => 
    item.nama_barang.toLowerCase().includes(search.toLowerCase())
  );

  const topSellingItems = useMemo(() => {
    return [...items]
      .sort((a, b) => b.jumlah_terjual - a.jumlah_terjual)
      .slice(0, 5)
      .map(item => ({
        name: item.nama_barang,
        Terjual: item.jumlah_terjual,
        Stok: item.stok_saat_ini,
        safety: item.safety_stock,
        isLow: item.stok_saat_ini <= item.safety_stock,
      }));
  }, [items]);

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Tidak ada data', text: 'Belum ada data inventori untuk diekspor.' });
      return;
    }
    
    const headers = ['Kode', 'Nama Barang', 'Kategori', 'Stok Saat Ini', 'Safety Stock', 'Harga Beli (Grosir)', 'Harga Jual (Eceran)', 'Margin Untung', 'Terjual'];
    const rows = filteredItems.map(item => [
      item.id_barang,
      item.nama_barang,
      item.kategori || '-',
      item.stok_saat_ini.toString(),
      item.safety_stock.toString(),
      item.harga_grosir.toString(),
      item.harga_eceran.toString(),
      (item.harga_eceran - item.harga_grosir).toString(),
      item.jumlah_terjual.toString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n"
      + rows.map(e => e.join(',')).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_inventori_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Panel */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nama menu / barang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4" />
            Ekspor CSV
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 md:flex-none w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 py-2 text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tambah Barang
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950 border border-rose-800 text-rose-300 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Visual Analytics Grid: Recharts Bar Chart & Inventory Stats Bento Card */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Chart Card */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                  <BarChart4 className="w-4 h-4 text-indigo-400" />
                  Tren Barang Terlaris & Sisa Stok
                </h3>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-800/40">
                  Top 5 Terlaris
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-6">
                Visualisasi sisa stok vs total terjual untuk barang-barang terpopuler Sumo PS.
              </p>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSellingItems}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomInventoryTooltip />} cursor={{ fill: '#0f172a', opacity: 0.4 }} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} 
                  />
                  <Bar name="Terjual (Porsi/Pcs)" dataKey="Terjual" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar name="Sisa Stok" dataKey="Stok" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18}>
                    {topSellingItems.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isLow ? '#f43f5e' : '#10b981'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Highlight Stats Bento Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                Ringkasan Stok & Kinerja
              </h4>
              
              <div className="space-y-3.5">
                {/* Stat 1: Low Stock warning */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Warning Stok Menipis</div>
                    <div className="text-base font-bold text-white font-display">
                      {items.filter(item => item.stok_saat_ini <= item.safety_stock).length} <span className="text-xs text-slate-400 font-normal">Barang</span>
                    </div>
                  </div>
                </div>

                {/* Stat 2: Total Items */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Total Varian Barang</div>
                    <div className="text-base font-bold text-white font-display">
                      {items.length} <span className="text-xs text-slate-400 font-normal">Menu/Barang</span>
                    </div>
                  </div>
                </div>

                {/* Stat 3: Top Item */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Barang Paling Laris</div>
                    <div className="text-xs font-bold text-white font-display truncate max-w-[180px]">
                      {topSellingItems[0]?.name || '-'}
                      {topSellingItems[0] && (
                        <span className="text-emerald-400 font-mono text-[10px] font-semibold block mt-0.5">
                          Terjual {topSellingItems[0].Terjual} Porsi
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Datatable */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <p className="text-xs text-slate-500 text-center py-16 font-mono">Memuat database inventori...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-16 font-mono">Tidak ada data inventori ditemukan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="p-4">Kode</th>
                  <th className="p-4">Nama Barang / Menu</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Stok Saat Ini</th>
                  <th className="p-4 text-right">Safety Stock</th>
                  <th className="p-4 text-right">Harga Grosir</th>
                  <th className="p-4 text-right">Harga Jual</th>
                  <th className="p-4 text-right">Margin Untung</th>
                  <th className="p-4 text-right">Terjual</th>
                  <th className="p-4 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredItems.map((item) => {
                  const profit = item.harga_eceran - item.harga_grosir;
                  const isStockWarning = item.stok_saat_ini <= item.safety_stock;
                  return (
                    <tr key={item.id_barang} className="hover:bg-slate-950/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-500 text-[10px]">{item.id_barang}</td>
                      <td className="p-4 font-bold text-slate-100 font-display text-sm">
                        {item.nama_barang}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-slate-950/60 border-slate-800 text-indigo-400">
                          {item.kategori}
                        </span>
                      </td>
                      <td className="p-4 text-left">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.status === 'baik' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          item.status === 'perlu perbaikan' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {item.status || 'baik'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-semibold">
                        <span className={isStockWarning ? 'text-rose-400 flex items-center gap-1 justify-end font-extrabold' : 'text-slate-200'}>
                          {isStockWarning && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                          {item.stok_saat_ini}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-400">{item.safety_stock}</td>
                      <td className="p-4 text-right font-mono text-slate-400">Rp {item.harga_grosir.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right font-mono text-emerald-400 font-semibold">Rp {item.harga_eceran.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right font-mono text-indigo-400 font-medium">Rp {profit.toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right font-mono text-slate-400">{item.jumlah_terjual}</td>
                      <td className="p-4">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg hover:text-white transition-colors"
                            title="Edit Data"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id_barang, item.nama_barang)}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-900/30 text-rose-400 rounded-lg transition-colors"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRUD MODALS */}
      <AnimatePresence>
        {showModal !== 'none' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4 flex-shrink-0">
                <h3 className="text-lg font-bold text-white font-display flex items-center gap-1.5">
                  <Package className="w-5 h-5 text-indigo-400" />
                  {showModal === 'add' ? 'Tambah Barang Inventori' : 'Edit Barang Inventori'}
                </h3>
                <button
                  onClick={() => setShowModal('none')}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nama Barang / Menu</label>
                  <input
                    type="text"
                    value={namaBarang}
                    onChange={(e) => setNamaBarang(e.target.value)}
                    placeholder="Contoh: Coca Cola 250ml"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kategori</label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Camilan">Camilan</option>
                    <option value="Alat">Alat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={statusItem}
                    onChange={(e) => setStatusItem(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="baik">Baik</option>
                    <option value="perlu perbaikan">Perlu Perbaikan</option>
                    <option value="rusak">Rusak</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Stok Saat Ini</label>
                    <input
                      type="number"
                      min="0"
                      value={stokSaatIni}
                      onChange={(e) => setStokSaatIni(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Safety Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={safetyStock}
                      onChange={(e) => setSafetyStock(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Harga Grosir (Beli)</label>
                    <input
                      type="number"
                      min="0"
                      value={hargaGrosir}
                      onChange={(e) => setHargaGrosir(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Harga Eceran (Jual)</label>
                    <input
                      type="number"
                      min="0"
                      value={hargaEceran}
                      onChange={(e) => setHargaEceran(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Estimate Profit Margin box */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-400">
                  <div className="flex justify-between font-semibold text-slate-300">
                    <span>Estimasi Margin Keuntungan:</span>
                    <span className="text-indigo-400 font-mono">Rp {(hargaEceran - hargaGrosir).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModal('none')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40"
                  >
                    <Check className="w-4 h-4" /> Simpan Data
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
