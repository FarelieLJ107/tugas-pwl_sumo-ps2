import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  User, 
  Smartphone, 
  Key, 
  Calendar, 
  DollarSign, 
  ClipboardList, 
  Wrench, 
  Plus, 
  Check, 
  CheckCircle, 
  Clock, 
  Search, 
  RefreshCw, 
  AlertTriangle,
  X,
  Phone
} from 'lucide-react';
import Swal from 'sweetalert2';
import { RentalKonsol, DetailRental, Inventori, LaporanKerusakan } from '../types';

interface RentalPanelProps {
  token: string;
}

export const RentalPanel: React.FC<RentalPanelProps> = ({ token }) => {
  const [rentals, setRentals] = useState<RentalKonsol[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'tersedia' | 'disewa' | 'maintenance'>('all');

  // Modal State for renting
  const [rentModalOpen, setRentModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<RentalKonsol | null>(null);
  
  // Rent Form State
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [jaminan, setJaminan] = useState('KTP');
  const [customJaminan, setCustomJaminan] = useState('');
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([
    'Kabel HDMI',
    'Kabel Power',
    'Stik 1',
    'Stik 2'
  ]);
  const [durationDays, setDurationDays] = useState(1);
  const [ratePerDay, setRatePerDay] = useState(50000);
  const [kondisiKeluar, setKondisiKeluar] = useState('Semua stik & kabel lengkap & normal');
  const [notes, setNotes] = useState('');

  // Modal State for returning
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningRental, setReturningRental] = useState<RentalKonsol | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [kondisiKembali, setKondisiKembali] = useState('Semua stik & kabel lengkap & normal');
  const [dendaKerusakan, setDendaKerusakan] = useState(0);

  // States for damage tracking and reporting
  const [inventoryItems, setInventoryItems] = useState<Inventori[]>([]);
  const [damageReports, setDamageReports] = useState<LaporanKerusakan[]>([]);
  const [selectedDamagedItemId, setSelectedDamagedItemId] = useState<string>('');
  const [showReportsView, setShowReportsView] = useState(false);

  const accessoriesOptions = [
    'Kabel HDMI',
    'Kabel Power',
    'Stik 1',
    'Stik 2',
    'Tas PS3',
    'Kabel Charger Stik'
  ];

  const jaminanOptions = [
    'KTP Asli',
    'SIM A',
    'SIM C',
    'Kartu Pelajar / Mahasiswa',
    'KK (Kartu Keluarga)',
    'Lainnya'
  ];

  // Fetch home rental consoles
  const fetchRentals = async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/rental-bawa-pulang', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setRentals(data);
      } else {
        console.error('Failed to fetch rentals:', data.error);
      }
    } catch (e) {
      console.error('Error fetching rentals:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/inventori', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryItems(data);
      }
    } catch (e) {
      console.error('Error fetching inventory in RentalPanel:', e);
    }
  };

  const fetchDamageReports = async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/laporan-kerusakan', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDamageReports(data);
      }
    } catch (e) {
      console.error('Error fetching damage reports:', e);
    }
  };

  const resolveDamageReport = async (id: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/laporan-kerusakan/${id}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Perbaikan Selesai',
          text: 'Barang telah ditandai selesai diperbaiki dan status inventori dikembalikan ke Baik.',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#6366f1'
        });
        fetchDamageReports();
        fetchInventory();
      } else {
        const err = await res.json();
        Swal.fire('Error', err.error || 'Gagal meresolve laporan', 'error');
      }
    } catch (e) {
      console.error('Error resolving damage report:', e);
    }
  };

  useEffect(() => {
    fetchRentals();
    fetchInventory();
    fetchDamageReports();

    // Setup listener or interval for active check-ins or WS
    const handleWsMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const payload = customEvent.detail;
      if (payload && (payload.type === 'rental:status_changed' || payload.type === 'tv:checkout')) {
        fetchRentals();
        fetchInventory();
        fetchDamageReports();
      }
    };

    window.addEventListener('ws-message', handleWsMessage);
    
    // Check if we can hook to existing WebSocket
    // Since App.tsx has its own WebSocket, our interval or manual refresh handles safety
    const interval = setInterval(() => {
      fetchRentals();
      fetchInventory();
      fetchDamageReports();
    }, 15000); // Poll every 15s as fallback

    return () => {
      window.removeEventListener('ws-message', handleWsMessage);
      clearInterval(interval);
    };
  }, []);

  // Handle Rent Submission
  const handleRentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental) return;

    if (!customerName.trim()) {
      Swal.fire('Error', 'Nama pelanggan wajib diisi', 'error');
      return;
    }
    if (!whatsapp.trim()) {
      Swal.fire('Error', 'Nomor WhatsApp wajib diisi', 'error');
      return;
    }

    const finalJaminan = jaminan === 'Lainnya' ? customJaminan : jaminan;
    if (!finalJaminan.trim()) {
      Swal.fire('Error', 'Jenis jaminan wajib ditentukan', 'error');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/rental-bawa-pulang/${selectedRental.id_rental}/rent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nama_pelanggan: customerName,
          no_whatsapp: whatsapp,
          jaminan: finalJaminan,
          perintilan: selectedAccessories,
          durasi_hari: durationDays,
          tarif_per_hari: ratePerDay,
          kondisi_keluar: kondisiKeluar,
          catatan: notes
        })
      });

      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          title: 'Sewa Berhasil!',
          text: `Sewa ${selectedRental.nama_konsol} untuk ${customerName} berhasil diaktifkan.`,
          icon: 'success',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
        setRentModalOpen(false);
        resetRentForm();
        fetchRentals();
      } else {
        Swal.fire('Gagal Sewa', data.error || 'Terjadi kesalahan sistem.', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menghubungi server.', 'error');
    }
  };

  // Handle Return Console Submission
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningRental) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/rental-bawa-pulang/${returningRental.id_rental}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          metode_pembayaran: paymentMethod,
          kondisi_kembali: kondisiKembali,
          denda_kerusakan: dendaKerusakan,
          id_barang_inventori: selectedDamagedItemId || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          title: 'Pengembalian Selesai',
          text: `${returningRental.nama_konsol} telah dikembalikan dan uang Rp ${((returningRental.detail?.total_bayar || 0) + dendaKerusakan).toLocaleString('id-ID')} dicatat ke dalam transaksi.`,
          icon: 'success',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#4f46e5'
        });
        setReturnModalOpen(false);
        setReturningRental(null);
        setSelectedDamagedItemId('');
        fetchRentals();
        fetchInventory();
        fetchDamageReports();
      } else {
        Swal.fire('Gagal Pengembalian', data.error || 'Terjadi kesalahan sistem.', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menghubungi server.', 'error');
    }
  };

  // Toggle Maintenance Mode
  const handleToggleMaintenance = async (rental: RentalKonsol) => {
    const isMaintenance = rental.status === 'maintenance';
    const endpoint = isMaintenance ? 'free' : 'maintenance';
    const text = isMaintenance 
      ? `Apakah Anda ingin mengembalikan status ${rental.nama_konsol} menjadi Tersedia?`
      : `Apakah Anda ingin menyetel ${rental.nama_konsol} ke status Maintenance?`;

    const confirm = await Swal.fire({
      title: 'Konfirmasi Perubahan Status',
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Ubah',
      cancelButtonText: 'Batal',
      background: '#0f172a',
      color: '#f8fafc',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#334155'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/rental-bawa-pulang/${rental.id_rental}/${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          Swal.fire({
            title: 'Status Diperbarui',
            text: `Status ${rental.nama_konsol} berhasil diubah.`,
            icon: 'success',
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#4f46e5'
          });
          fetchRentals();
        } else {
          const data = await res.json();
          Swal.fire('Gagal', data.error || 'Gagal merubah status.', 'error');
        }
      } catch (e) {
        Swal.fire('Error', 'Gagal menghubungi server.', 'error');
      }
    }
  };

  const openRentModal = (rental: RentalKonsol) => {
    setSelectedRental(rental);
    setRentModalOpen(true);
  };

  const openReturnModal = (rental: RentalKonsol) => {
    setReturningRental(rental);
    setKondisiKembali('Semua stik & kabel lengkap & normal');
    setDendaKerusakan(0);
    setSelectedDamagedItemId('');
    setReturnModalOpen(true);
  };

  const resetRentForm = () => {
    setSelectedRental(null);
    setCustomerName('');
    setWhatsapp('');
    setJaminan('KTP Asli');
    setCustomJaminan('');
    setSelectedAccessories(['Kabel HDMI', 'Kabel Power', 'Stik 1', 'Stik 2']);
    setDurationDays(1);
    setRatePerDay(50000);
    setKondisiKeluar('Semua stik & kabel lengkap & normal');
    setNotes('');
  };

  const toggleAccessory = (acc: string) => {
    if (selectedAccessories.includes(acc)) {
      setSelectedAccessories(selectedAccessories.filter(item => item !== acc));
    } else {
      setSelectedAccessories([...selectedAccessories, acc]);
    }
  };

  // Filter rentals based on search and status
  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = 
      rental.nama_konsol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rental.id_rental.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rental.detail?.nama_pelanggan || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rental.detail?.no_whatsapp || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    return rental.status === statusFilter && matchesSearch;
  });

  // Helper to check if a rental is late/overdue based on start date and duration days
  const checkIsOverdue = (detail?: DetailRental) => {
    if (!detail) return { isLate: false, hoursLate: 0 };
    const startTime = new Date(detail.waktu_mulai).getTime();
    const durationMs = detail.durasi_hari * 24 * 60 * 60 * 1000;
    const deadline = startTime + durationMs;
    const now = Date.now();
    
    if (now > deadline) {
      const lateMs = now - deadline;
      const hoursLate = Math.ceil(lateMs / (1000 * 60 * 60));
      return { isLate: true, hoursLate };
    }
    return { isLate: false, hoursLate: 0 };
  };

  // Remaining time formatted helper
  const getRemainingTimeText = (detail?: DetailRental) => {
    if (!detail) return '';
    const startTime = new Date(detail.waktu_mulai).getTime();
    const durationMs = detail.durasi_hari * 24 * 60 * 60 * 1000;
    const deadline = startTime + durationMs;
    const now = Date.now();
    
    if (now > deadline) {
      const lateMs = now - deadline;
      const hoursLate = Math.floor(lateMs / (1000 * 60 * 60));
      const daysLate = Math.floor(hoursLate / 24);
      if (daysLate > 0) {
        return `Terlambat ${daysLate} Hari ${hoursLate % 24} Jam`;
      }
      return `Terlambat ${hoursLate} Jam`;
    } else {
      const remainingMs = deadline - now;
      const hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
      const daysRemaining = Math.floor(hoursRemaining / 24);
      if (daysRemaining > 0) {
        return `Sisa ${daysRemaining} Hari ${hoursRemaining % 24} Jam`;
      }
      return `Sisa ${hoursRemaining} Jam`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-indigo-400 animate-pulse" />
            Sistem Sewa Bawa Pulang Konsol (Take Home Rental)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manajemen persewaan 10 unit PS3 Sumo PS beserta aksesorinya (HDMI, Stik, dll) untuk dibawa pulang pelanggan.
          </p>
        </div>
        <div className="flex gap-3 text-xs font-mono">
          <button
            onClick={() => setShowReportsView(!showReportsView)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl font-bold transition-all cursor-pointer shadow-sm ${
              showReportsView 
                ? 'bg-amber-600/20 text-amber-400 border-amber-500/40' 
                : 'bg-slate-850 hover:bg-slate-800 text-slate-200 border-slate-750'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {showReportsView ? 'Lihat Daftar Rental' : `Laporan Kerusakan (${damageReports.filter(r => r.status === 'perlu perbaikan').length})`}
          </button>
          <button
            onClick={fetchRentals}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 rounded-xl font-bold transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan Data
          </button>
        </div>
      </div>

      {/* Statistics & Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stats card 1 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-indigo-400 shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Total Konsol Rental</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{rentals.length}</p>
          </div>
        </div>

        {/* Stats card 2 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-emerald-400 shrink-0">
            <CheckCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Tersedia di Toko</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{rentals.filter(r => r.status === 'tersedia').length}</p>
          </div>
        </div>

        {/* Stats card 3 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-rose-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Sedang Dibawa Pulang</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{rentals.filter(r => r.status === 'disewa').length}</p>
          </div>
        </div>

        {/* Stats card 4 */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 text-amber-500 shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Dalam Maintenance</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{rentals.filter(r => r.status === 'maintenance').length}</p>
          </div>
        </div>
      </div>

      {showReportsView ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-fade-in text-xs font-mono">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-bold text-white font-display">Laporan Kerusakan & Denda Otomatis</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Mencatat barang denda rusak/hilang dari rental bawa pulang & status penanganannya.</p>
            </div>
            <div className="text-[10px] bg-slate-950 border border-slate-800 px-3 py-1 rounded-xl text-slate-400">
              Total Laporan: <span className="text-amber-400 font-bold">{damageReports.length}</span> | Perlu Perbaikan: <span className="text-rose-400 font-bold">{damageReports.filter(r => r.status === 'perlu perbaikan').length}</span>
            </div>
          </div>

          {damageReports.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs italic">
              Belum ada laporan kerusakan yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/50">
                    <th className="py-3 px-4">Tanggal / ID</th>
                    <th className="py-3 px-4">Konsol & Penyewa</th>
                    <th className="py-3 px-4">Barang Rusak (Inventori)</th>
                    <th className="py-3 px-4">Deskripsi Kerusakan</th>
                    <th className="py-3 px-4 text-right">Denda Kerusakan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {damageReports.map((report) => (
                    <tr key={report.id_laporan} className="hover:bg-slate-850/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="text-slate-400 text-[10px] block">{new Date(report.tanggal_laporan).toLocaleString('id-ID')}</span>
                        <span className="text-indigo-400 font-bold text-[9px]">#{report.id_laporan}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-white font-bold block">{report.nama_konsol}</span>
                        <span className="text-slate-400 text-[10px] block font-sans">Penyewa: {report.nama_pelanggan}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {report.nama_barang_inventori ? (
                          <div className="space-y-1">
                            <span className="text-slate-200 font-semibold block">{report.nama_barang_inventori}</span>
                            <span className="text-[9px] text-rose-400 bg-rose-950/40 border border-rose-900/30 px-2 py-0.5 rounded font-extrabold inline-block">
                              STATUS: PERLU PERBAIKAN
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">Umum / Non-Inventori</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-sans max-w-xs truncate" title={report.detail_kerusakan}>
                        {report.detail_kerusakan}
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-400 font-bold text-sm">
                        Rp {report.denda.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          report.status === 'perlu perbaikan' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {report.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {report.status === 'perlu perbaikan' ? (
                          <button
                            type="button"
                            onClick={() => resolveDamageReport(report.id_laporan)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold font-sans cursor-pointer transition-colors"
                          >
                            Selesai Diperbaiki
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[10px] italic">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nama konsol, ID, penyewa, atau WA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-all ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-slate-200'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setStatusFilter('tersedia')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-all ${
              statusFilter === 'tersedia' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-slate-200'
            }`}
          >
            Tersedia
          </button>
          <button
            onClick={() => setStatusFilter('disewa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-all ${
              statusFilter === 'disewa' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-slate-200'
            }`}
          >
            Disewa
          </button>
          <button
            onClick={() => setStatusFilter('maintenance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-all ${
              statusFilter === 'maintenance' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-slate-200'
            }`}
          >
            Maintenance
          </button>
        </div>
      </div>

      {/* Grid view of Take Home Consoles */}
      {loading && rentals.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-xs font-mono">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-400" />
          Memuat data unit rental bawa pulang...
        </div>
      ) : filteredRentals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-500 text-xs font-mono">
          Tidak ada data konsol rental bawa pulang yang cocok dengan filter Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredRentals.map((rental) => {
            const isLate = rental.status === 'disewa' && checkIsOverdue(rental.detail).isLate;
            return (
              <div 
                key={rental.id_rental}
                className={`bg-slate-900 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 relative shadow-md ${
                  rental.status === 'disewa' 
                    ? isLate 
                      ? 'border-rose-600/80 bg-slate-900/90 shadow-rose-950/20 shadow-lg'
                      : 'border-indigo-500/50 bg-slate-900' 
                    : rental.status === 'maintenance'
                      ? 'border-amber-600/40 bg-slate-900/95'
                      : 'border-slate-800 hover:border-slate-700 hover:shadow-lg'
                }`}
              >
                {/* Visual Accent header */}
                <div className={`h-1.5 w-full ${
                  rental.status === 'disewa' 
                    ? isLate ? 'bg-rose-500' : 'bg-indigo-500' 
                    : rental.status === 'maintenance'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`} />

                {/* Card Header & Unit Spec */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">{rental.id_rental}</span>
                      <h4 className="text-sm font-bold text-white tracking-tight font-display">{rental.nama_konsol}</h4>
                    </div>
                    <div>
                      {rental.status === 'tersedia' && (
                        <span className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 font-mono font-bold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Tersedia
                        </span>
                      )}
                      {rental.status === 'disewa' && (
                        <span className={`font-mono font-bold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isLate 
                            ? 'bg-rose-950 border border-rose-800 text-rose-400' 
                            : 'bg-indigo-950/80 border border-indigo-900/60 text-indigo-400'
                        }`}>
                          {isLate ? 'TERLAMBAT' : 'DIBAWA PULANG'}
                        </span>
                      )}
                      {rental.status === 'maintenance' && (
                        <span className="bg-amber-950/40 border border-amber-900/60 text-amber-400 font-mono font-bold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          Maintenance
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Info */}
                  {rental.status === 'tersedia' && (
                    <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>Konsol:</span>
                        <span className="text-slate-200 font-bold">{rental.jenis_konsol} (HDD Games)</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>Tarif Standard:</span>
                        <span className="text-emerald-400 font-bold">Rp 50.000 / hari</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>Kelengkapan:</span>
                        <span className="text-slate-200 text-right">HDMI, Power, 2 Stik</span>
                      </div>
                    </div>
                  )}

                  {rental.status === 'maintenance' && (
                    <div className="bg-amber-950/10 border border-amber-900/30 p-3.5 rounded-xl flex items-center gap-3 text-xs text-amber-400/90 font-mono">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-bold">Pemeliharaan Unit</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Sedang diservis atau pengecekan hardware berkala.</p>
                      </div>
                    </div>
                  )}

                  {rental.status === 'disewa' && rental.detail && (
                    <div className="space-y-3.5 pt-1 text-xs">
                      {/* Customer info card */}
                      <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2 border-b border-slate-800/50 pb-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="font-bold text-slate-100 truncate">{rental.detail.nama_pelanggan}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <a 
                              href={`https://wa.me/${rental.detail.no_whatsapp.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              {rental.detail.no_whatsapp}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Key className="w-3 h-3 text-slate-500" />
                            <span>Jaminan: <b className="text-slate-200">{rental.detail.jaminan}</b></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>Durasi: <b className="text-slate-200">{rental.detail.durasi_hari} hari</b></span>
                          </div>
                        </div>
                      </div>

                      {/* Accessories lent out */}
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <ClipboardList className="w-3 h-3 text-indigo-400" />
                          Aksesori Dibawa:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rental.detail.perintilan && rental.detail.perintilan.length > 0 ? (
                            rental.detail.perintilan.map((item, idx) => (
                              <span key={idx} className="bg-slate-850 border border-slate-800 text-[9px] px-1.5 py-0.5 rounded text-slate-300 font-mono">
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono italic">Hanya konsol saja</span>
                          )}
                        </div>
                      </div>

                      {/* Kondisi Keluar info */}
                      <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850/60 font-mono text-[10px] text-slate-300">
                        <p className="font-bold text-slate-400 uppercase tracking-wider text-[9px] flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                          Kondisi Saat Keluar:
                        </p>
                        <p className="mt-0.5 text-slate-200">{rental.detail.kondisi_keluar || 'Sangat Baik / Lengkap'}</p>
                      </div>

                      {/* Time trackers & Cost */}
                      <div className="bg-slate-950/60 border border-slate-850/80 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-500 font-bold text-[10px] uppercase flex items-center gap-1">
                            <Clock className={`w-3.5 h-3.5 ${isLate ? 'text-rose-500' : 'text-indigo-400'}`} />
                            Estimasi Sisa:
                          </span>
                          <span className={`font-bold ${isLate ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`}>
                            {getRemainingTimeText(rental.detail)}
                          </span>
                        </div>
                        <div className="border-t border-slate-850/65 pt-2 flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-500 text-[10px] uppercase">Tagihan Rental:</span>
                          <span className="text-emerald-400 font-extrabold text-sm">
                            Rp {rental.detail.total_bayar.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons / actions */}
                <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex gap-2">
                  {rental.status === 'tersedia' && (
                    <>
                      <button
                        onClick={() => openRentModal(rental)}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm shadow-indigo-950/40"
                      >
                        <Plus className="w-4 h-4" />
                        Sewa Sekarang
                      </button>
                      <button
                        onClick={() => handleToggleMaintenance(rental)}
                        title="Setel Maintenance"
                        className="p-2 bg-slate-850 hover:bg-slate-800 hover:text-amber-400 border border-slate-750 text-slate-400 rounded-xl cursor-pointer transition-all active:scale-95"
                      >
                        <Wrench className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {rental.status === 'maintenance' && (
                    <button
                      onClick={() => handleToggleMaintenance(rental)}
                      className="flex-1 py-2 px-3 bg-slate-850 hover:bg-slate-800 text-amber-400 border border-slate-750 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      Selesaikan Servis (Setel Tersedia)
                    </button>
                  )}

                  {rental.status === 'disewa' && (
                    <>
                      <button
                        onClick={() => openReturnModal(rental)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm shadow-emerald-950/40"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Kembalikan (Check-In)
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* RENT OUT FORM MODAL */}
      {rentModalOpen && selectedRental && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-indigo-400 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight font-display">Mulai Sewa Bawa Pulang</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedRental.nama_konsol} ({selectedRental.id_rental})</p>
                </div>
              </div>
              <button 
                onClick={() => setRentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleRentSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Muhammad Rafli"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white"
                />
              </div>

              {/* Whatsapp */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                  Nomor WhatsApp / HP Aktif *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 081234567890"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white font-mono"
                />
              </div>

              {/* Jaminan */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    Dokumen Jaminan *
                  </label>
                  <select
                    value={jaminan}
                    onChange={(e) => setJaminan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 text-white cursor-pointer"
                  >
                    {jaminanOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    Durasi Sewa *
                  </label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      required
                      value={durationDays}
                      onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-transparent border-none py-1.5 outline-none text-white font-mono text-center text-sm"
                    />
                    <span className="text-slate-400 font-bold pr-1">Hari</span>
                  </div>
                </div>
              </div>

              {/* Custom Jaminan if chosen "Lainnya" */}
              {jaminan === 'Lainnya' && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">Sebutkan Dokumen Jaminan Lainnya *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: STNK Motor / Ijazah"
                    value={customJaminan}
                    onChange={(e) => setCustomJaminan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white"
                  />
                </div>
              )}

              {/* Rates */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                  Tarif Sewa per Hari (Rp)
                </label>
                <input
                  type="number"
                  step={5000}
                  required
                  value={ratePerDay}
                  onChange={(e) => setRatePerDay(Math.max(1000, parseInt(e.target.value) || 50000))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white font-mono"
                />
              </div>

              {/* Accessories checklist */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                  Pilih Kelengkapan & Perintilan Bawaan
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                  {accessoriesOptions.map((acc, idx) => {
                    const isChecked = selectedAccessories.includes(acc);
                    return (
                      <label 
                        key={idx} 
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked 
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-300' 
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAccessory(acc)}
                          className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="font-mono text-[10px]">{acc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Kondisi Keluar */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  Kondisi Saat Keluar *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Stik 1 & 2 Normal, Body mulus, Kabel lengkap"
                  value={kondisiKeluar}
                  onChange={(e) => setKondisiKeluar(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Catatan Khusus (Opsional)</label>
                <textarea
                  placeholder="Kondisi fisik konsol, aksesoris tambahan, dll..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white resize-none"
                />
              </div>

              {/* Live Billing Preview Card */}
              <div className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-xl space-y-2 font-mono">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Kalkulasi Tagihan Sementara</p>
                <div className="flex justify-between text-slate-400">
                  <span>Sewa:</span>
                  <span>{durationDays} hari x Rp {ratePerDay.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-slate-900 pt-1.5 flex justify-between items-center text-slate-200">
                  <span className="font-bold">Total Tagihan:</span>
                  <span className="text-emerald-400 font-extrabold text-sm">Rp {(durationDays * ratePerDay).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRentModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/20 rounded-xl text-white font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Aktifkan Sewa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-IN / RETURN MODAL */}
      {returnModalOpen && returningRental && returningRental.detail && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in text-xs">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight font-display">Pengembalian & Check-In</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{returningRental.nama_konsol}</p>
                </div>
              </div>
              <button 
                onClick={() => setReturnModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-5 space-y-4 font-mono">
              <div className="space-y-3 bg-slate-950/50 border border-slate-850 p-4 rounded-xl text-[11px] text-slate-300">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-display border-b border-slate-900 pb-1.5">Informasi Penyewa</p>
                <div className="flex justify-between">
                  <span className="text-slate-400">Penyewa:</span>
                  <span className="text-slate-100 font-bold">{returningRental.detail.nama_pelanggan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">WhatsApp:</span>
                  <span className="text-indigo-400">{returningRental.detail.no_whatsapp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jaminan:</span>
                  <span className="text-slate-100">{returningRental.detail.jaminan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lama Sewa:</span>
                  <span>{returningRental.detail.durasi_hari} hari</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400">Perintilan yang harus kembali:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {returningRental.detail.perintilan && returningRental.detail.perintilan.length > 0 ? (
                      returningRental.detail.perintilan.map((item, idx) => (
                        <span key={idx} className="bg-slate-900 border border-slate-800 text-[9px] px-1.5 py-0.5 rounded text-slate-400">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Tidak ada</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 font-sans">
                <label className="font-semibold text-slate-300 block">Metode Pembayaran *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'cash' 
                        ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    💵 CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'qris' 
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📱 QRIS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'transfer' 
                        ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    🏦 TRANSFER
                  </button>
                </div>
              </div>

              {/* Kondisi Saat Kembali */}
              <div className="space-y-1.5 font-sans">
                <label className="font-semibold text-slate-300 block">Kondisi Saat Kembali *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Lengkap / Sesuai, Stik 1 & 2 Bagus"
                  value={kondisiKembali}
                  onChange={(e) => setKondisiKembali(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white font-mono"
                />
              </div>

              {/* Barang Inventori Rusak (Opsional) */}
              <div className="space-y-1.5 font-sans">
                <label className="font-semibold text-slate-300 block">Hubungkan ke Barang Inventori (Opsional)</label>
                <select
                  value={selectedDamagedItemId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDamagedItemId(val);
                    if (val) {
                      const matched = inventoryItems.find(p => p.id_barang === val);
                      setKondisiKembali(`Kerusakan pada: ${matched ? matched.nama_barang : 'Barang'}`);
                      if (dendaKerusakan === 0) {
                        setDendaKerusakan(25000); // Default placeholder fine to encourage log
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white font-mono"
                >
                  <option value="">-- Tidak Ada / Sesuai Lengkap --</option>
                  {inventoryItems.filter(item => 
                    item.kategori === 'Alat' || 
                    item.nama_barang.toLowerCase().includes('stik') || 
                    item.nama_barang.toLowerCase().includes('kabel') ||
                    item.nama_barang.toLowerCase().includes('tas')
                  ).map(item => (
                    <option key={item.id_barang} value={item.id_barang}>
                      {item.nama_barang} (Stok: {item.stok_saat_ini} - Status: {item.status || 'baik'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 italic mt-0.5">Memilih barang akan otomatis membuat laporan kerusakan dan menyetel status barang di inventori menjadi 'perlu perbaikan'.</p>
              </div>

              {/* Denda Kerusakan */}
              <div className="space-y-1.5 font-sans">
                <label className="font-semibold text-slate-300 block">Denda Kerusakan / Hilang (Rp)</label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={dendaKerusakan}
                  onChange={(e) => setDendaKerusakan(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 outline-none focus:border-indigo-500 text-white font-mono"
                />
              </div>

              {/* Tagihan Final */}
              <div className="bg-emerald-950/25 border border-emerald-900/40 p-4 rounded-xl text-center space-y-1">
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider font-display">Rincian Tagihan</p>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono px-2">
                  <span>Sewa Base:</span>
                  <span>Rp {returningRental.detail.total_bayar.toLocaleString('id-ID')}</span>
                </div>
                {dendaKerusakan > 0 && (
                  <div className="flex justify-between text-[11px] text-rose-400 font-mono px-2">
                    <span>Denda Kerusakan:</span>
                    <span>Rp {dendaKerusakan.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="border-t border-slate-800/80 my-1.5" />
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider font-display">Total Tagihan Lunas</p>
                <p className="text-2xl font-black text-emerald-400">Rp {(returningRental.detail.total_bayar + dendaKerusakan).toLocaleString('id-ID')}</p>
                <p className="text-[9px] text-slate-400 mt-1 italic font-sans">Pastikan semua perintilan dan kelengkapan konsol di atas sudah diperiksa dan diterima dengan baik sebelum checkout.</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-slate-300 font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20 rounded-xl text-white font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Proses Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
