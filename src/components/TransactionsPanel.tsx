import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Tv, 
  ReceiptText, 
  Printer, 
  X, 
  DollarSign, 
  CheckCircle,
  Calendar,
  Download
} from 'lucide-react';
import { Transaksi } from '../types';
import Swal from 'sweetalert2';

interface TransactionsPanelProps {
  token: string;
}

export const TransactionsPanel: React.FC<TransactionsPanelProps> = ({ token }) => {
  const [list, setList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTrx, setSelectedTrx] = useState<Transaksi | null>(null);
  const [trxDetails, setTrxDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/transaksi', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengambil data transaksi.');
      // The API returns { summary, chartData, popularMenus, list }
      setList(json.list || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleOpenReceipt = async (trx: Transaksi) => {
    setSelectedTrx(trx);
    setLoadingDetails(true);
    setTrxDetails([]);
    try {
      // Fetch billing details to see ordered items
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/billing/${trx.id_billing}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Find ordered menu details
        setTrxDetails(data.menuDetails || []);
      }
    } catch (err) {
      console.error('Failed to load transaction details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredTransactions = list.filter((trx) => {
    const term = search.toLowerCase();
    const idMatches = trx.id_transaksi.toLowerCase().includes(term);
    const billingMatches = trx.id_billing?.toLowerCase().includes(term);
    const tvMatches = trx.id_tv ? `tv-0${trx.id_tv}`.includes(term) : false;
    const methodMatches = trx.metode_pembayaran.toLowerCase().includes(term);
    return idMatches || billingMatches || tvMatches || methodMatches;
  });

  const handlePrintMock = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Tidak ada data', text: 'Belum ada transaksi untuk diekspor.' });
      return;
    }
    
    const headers = ['ID Transaksi', 'ID Billing', 'TV', 'Waktu', 'Sewa TV', 'Konsumsi', 'Total Bayar', 'Metode Pembayaran'];
    const rows = filteredTransactions.map(trx => [
      trx.id_transaksi,
      trx.id_billing,
      trx.id_tv ? `TV-0${trx.id_tv}` : 'Sistem',
      new Date(trx.tanggal_transaksi).toLocaleString('id-ID'),
      trx.total_sewa.toString(),
      trx.total_menu.toString(),
      trx.total_bayar.toString(),
      trx.metode_pembayaran
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + "\n"
      + rows.map(e => e.join(',')).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daftar_transaksi_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-400" />
            Daftar Transaksi Billing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Lihat riwayat sewa, rincian billing, cetak struk pembayaran, dan kelola pembayaran kasir.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID, TV-0X, metode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors border border-slate-700 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500 font-mono text-xs">
          Memuat riwayat transaksi...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950 border border-rose-800 text-rose-300 rounded-2xl text-xs">
          {error}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="p-4">ID Transaksi</th>
                  <th className="p-4">ID Billing</th>
                  <th className="p-4">Konsol / TV</th>
                  <th className="p-4 text-right">Biaya Sewa</th>
                  <th className="p-4 text-right">Biaya Menu</th>
                  <th className="p-4 text-right font-bold">Total Bayar</th>
                  <th className="p-4 text-center">Metode</th>
                  <th className="p-4 text-right">Tanggal Transaksi</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Tidak ada transaksi ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((trx) => (
                    <tr key={trx.id_transaksi} className="hover:bg-slate-950/20 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-400 text-[11px]">
                        {trx.id_transaksi}
                      </td>
                      <td className="p-4 font-mono text-slate-500 text-[11px]">
                        {trx.id_billing?.substring(0, 12)}...
                      </td>
                      <td className="p-4 font-semibold text-slate-200">
                        {trx.id_tv ? (
                          <span className="flex items-center gap-1.5">
                            <Tv className="w-3.5 h-3.5 text-indigo-400" />
                            TV-0{trx.id_tv}
                          </span>
                        ) : (
                          'Sistem'
                        )}
                      </td>
                      <td className="p-4 text-right font-mono">
                        Rp {trx.total_sewa.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-right font-mono text-amber-500/80">
                        Rp {trx.total_menu.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        Rp {trx.total_bayar.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border font-bold ${
                          trx.metode_pembayaran === 'cash' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' :
                          trx.metode_pembayaran === 'qris' ? 'bg-indigo-950/40 border-indigo-800 text-indigo-400' :
                          'bg-amber-950/40 border-amber-800 text-amber-400'
                        }`}>
                          {trx.metode_pembayaran}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-400 text-[11px]">
                        {new Date(trx.tanggal_transaksi).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenReceipt(trx)}
                          className="bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/80 text-indigo-300 font-semibold px-3 py-1.5 rounded-lg text-[11px] transition-colors flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <ReceiptText className="w-3.5 h-3.5" /> Detail Struk
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECEIPT / STRUK INVOICE MODAL */}
      <AnimatePresence>
        {selectedTrx && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedTrx(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-950 rounded-lg border border-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 bg-indigo-950/50 border border-indigo-800 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ReceiptText className="w-6 h-6" />
                  </div>
                  <h3 className="text-md font-bold text-white font-display">Struk Pembayaran</h3>
                  <p className="text-[10px] text-slate-400">Sumo PlayStation Rental & Cafe</p>
                </div>

                {/* Printable Thermal Receipt Mock */}
                <div className="bg-white text-slate-900 p-5 rounded-lg shadow-inner font-mono text-[11px] leading-relaxed space-y-4 border-2 border-slate-300 relative print:p-0 print:border-none">
                  {/* Decorative thermal-style zigzag borders */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>

                  <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-1">
                    <p className="font-extrabold text-[13px] tracking-tight">SUMO PLAYSTATION</p>
                    <p className="text-[9px] text-slate-500">Jl. Sumo Raya No. 12, Bandung</p>
                    <p className="text-[9px] text-slate-500">Telp: 0812-3456-7890</p>
                  </div>

                  <div className="space-y-1 border-b border-dashed border-slate-400 pb-3">
                    <div className="flex justify-between">
                      <span>TRX ID:</span>
                      <span className="font-bold">{selectedTrx.id_transaksi}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>TANGGAL:</span>
                      <span>
                        {new Date(selectedTrx.tanggal_transaksi).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>KONSOL/TV:</span>
                      <span className="font-bold">
                        {selectedTrx.id_tv ? `TV-0${selectedTrx.id_tv}` : 'SISTEM'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Items */}
                  <div className="space-y-2 py-1">
                    <div className="flex justify-between">
                      <span>Biaya Sewa PlayStation</span>
                      <span>Rp {selectedTrx.total_sewa.toLocaleString('id-ID')}</span>
                    </div>

                    {loadingDetails ? (
                      <p className="text-slate-400 text-center py-2 text-[9px]">Memuat pesanan menu...</p>
                    ) : trxDetails.length > 0 ? (
                      <div className="space-y-1 pt-1 border-t border-dotted border-slate-300">
                        <p className="text-[10px] font-bold text-slate-500">KAFE / MENU:</p>
                        {trxDetails.map((item, idx) => (
                          <div key={idx} className="flex justify-between pl-2 text-[10px] text-slate-700">
                            <span>
                              {item.nama_barang} (x{item.jumlah})
                            </span>
                            <span>Rp {item.subtotal.toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-dashed border-slate-400 pt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>SUBTOTAL SEWA:</span>
                      <span>Rp {selectedTrx.total_sewa.toLocaleString('id-ID')}</span>
                    </div>
                    {selectedTrx.total_menu > 0 && (
                      <div className="flex justify-between font-bold">
                        <span>SUBTOTAL MENU:</span>
                        <span>Rp {selectedTrx.total_menu.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold border-t border-slate-300 pt-1.5 text-sm tracking-tight text-black">
                      <span>TOTAL BAYAR:</span>
                      <span>Rp {selectedTrx.total_bayar.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>METODE:</span>
                      <span className="uppercase font-bold">{selectedTrx.metode_pembayaran}</span>
                    </div>
                  </div>

                  <div className="text-center pt-3 border-t border-dashed border-slate-400 text-[10px] text-slate-500">
                    <p className="font-bold">TERIMA KASIH ATAS KUNJUNGAN ANDA</p>
                    <p>Main Puas, Sumo Puas!</p>
                  </div>
                </div>

                {/* Print action controls */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSelectedTrx(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl py-2.5 text-xs transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handlePrintMock}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-2.5 text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-950/40 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Cetak Struk
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
