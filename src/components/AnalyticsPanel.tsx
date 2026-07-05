import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  Tv, 
  Utensils, 
  Calendar, 
  ListOrdered, 
  ArrowUpRight, 
  FileText,
  TrendingUp,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  Download,
  Printer,
  Filter,
  Percent,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  AreaChart,
  Area,
  BarChart,
  Cell
} from 'recharts';
import { Transaksi } from '../types';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

interface AnalyticsPanelProps {
  token: string;
}

// Custom Tooltip styled for our beautiful dark theme
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 font-mono">
        <p className="font-bold text-slate-200 font-display text-[11px] mb-1">{label}</p>
        {payload.map((item: any, i: number) => (
          <div key={i} className="flex justify-between items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-400">{item.name}:</span>
            </span>
            <span className="font-bold" style={{ color: item.color }}>
              Rp {item.value.toLocaleString('id-ID')}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

const CustomTVUtilTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataObj = payload[0]?.payload;
    return (
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 font-mono">
        <p className="font-bold text-slate-200 font-display text-[11px] mb-1">{label}</p>
        <div className="flex justify-between items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-slate-400">Rata-Rata Utilisasi:</span>
          </span>
          <span className="font-bold text-indigo-400">
            {payload[0]?.value}%
          </span>
        </div>
        {dataObj?.avgHoursPerDay !== undefined && (
          <div className="flex justify-between items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Rata-Rata Durasi/Hari:</span>
            </span>
            <span className="font-bold text-emerald-400">
              {dataObj?.avgHoursPerDay} jam
            </span>
          </div>
        )}
        {dataObj?.totalHours !== undefined && (
          <div className="flex justify-between items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-slate-400">Total Durasi Sewa:</span>
            </span>
            <span className="font-bold text-amber-400">
              {dataObj?.totalHours} jam
            </span>
          </div>
        )}
        {dataObj?.total_transaksi !== undefined && (
          <div className="flex justify-between items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="text-slate-400">Total Frekuensi Sewa:</span>
            </span>
            <span className="font-bold text-purple-400">
              {dataObj?.total_transaksi} kali
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CustomTVTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 font-mono">
        <p className="font-bold text-slate-200 font-display text-[11px] mb-1">{label}</p>
        <div className="flex justify-between items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Utilisasi:</span>
          </span>
          <span className="font-bold text-emerald-400">
            {payload[0]?.value}%
          </span>
        </div>
        <p className="text-[9px] text-slate-500 mt-1">Asumsi 12 jam operasional per hari (720 menit)</p>
      </div>
    );
  }
  return null;
};

interface AnalyticsData {
  summary: {
    totalIncome: number;
    todayIncome: number;
    rentIncome: number;
    menuIncome: number;
    totalTrxCount: number;
    activeTvCount: number;
  };
  chartData: { tanggal: string; total: number }[];
  popularMenus: { nama: string; qty: number; revenue: number }[];
  list: Transaksi[];
}

type FilterPeriod = 'all' | 'today' | 'this_week' | 'this_month';

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ token }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<FilterPeriod>('all');
  const [selectedTvTrend, setSelectedTvTrend] = useState<string>('overall');
  const printRef = useRef<HTMLDivElement>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/transaksi', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengambil data laporan.');
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Filtered List based on period
  const filteredList = useMemo(() => {
    if (!data?.list) return [];
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    return data.list.filter(trx => {
      const trxDate = new Date(trx.tanggal_transaksi);
      const trxDateStr = trxDate.toISOString().split('T')[0];
      
      if (period === 'today') {
        return trxDateStr === todayStr;
      }
      
      if (period === 'this_week') {
        const pastWeek = new Date();
        pastWeek.setDate(now.getDate() - 7);
        return trxDate >= pastWeek && trxDate <= now;
      }
      
      if (period === 'this_month') {
        return trxDate.getMonth() === now.getMonth() && trxDate.getFullYear() === now.getFullYear();
      }
      
      return true;
    });
  }, [data?.list, period]);

  // Recalculate summary based on filter
  const activeSummary = useMemo(() => {
    if (!data) return null;
    if (period === 'all') return data.summary; // Use server default for 'all' to be fast
    
    let rentIncome = 0;
    let menuIncome = 0;
    let totalIncome = 0;
    
    filteredList.forEach(t => {
      rentIncome += t.total_sewa;
      menuIncome += t.total_menu;
      totalIncome += t.total_bayar;
    });
    
    return {
      ...data.summary,
      rentIncome,
      menuIncome,
      totalIncome,
      totalTrxCount: filteredList.length,
    };
  }, [data, filteredList, period]);

  const monthlyData = useMemo(() => {
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthlyMap: { [key: string]: { key: string; name: string; sewa: number; menu: number; total: number } } = {};

    if (data?.list) {
      data.list.forEach(trx => {
        try {
          const d = new Date(trx.tanggal_transaksi);
          if (isNaN(d.getTime())) return;
          const year = d.getFullYear();
          const month = d.getMonth();
          const sortKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          const displayName = `${MONTH_NAMES[month]} ${year}`;
          
          if (!monthlyMap[sortKey]) {
            monthlyMap[sortKey] = {
              key: sortKey,
              name: displayName,
              sewa: 0,
              menu: 0,
              total: 0
            };
          }
          monthlyMap[sortKey].sewa += trx.total_sewa;
          monthlyMap[sortKey].menu += trx.total_menu;
          monthlyMap[sortKey].total += trx.total_bayar;
        } catch (err) {
          console.error('Failed to parse date for monthly chart:', err);
        }
      });
    }

    return Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key));
  }, [data?.list]);

  const dailyTrend30Days = useMemo(() => {
    if (!data?.list) return [];

    const trendMap: Record<string, { tanggal: string; name: string; sewa: number; menu: number; total: number }> = {};
    
    // Create entries for the last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const name = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      trendMap[dateStr] = {
        tanggal: dateStr,
        name,
        sewa: 0,
        menu: 0,
        total: 0
      };
    }

    // Populate data from data.list
    data.list.forEach(trx => {
      try {
        const dateStr = trx.tanggal_transaksi.split('T')[0];
        if (trendMap[dateStr]) {
          trendMap[dateStr].sewa += trx.total_sewa;
          trendMap[dateStr].menu += trx.total_menu;
          trendMap[dateStr].total += trx.total_bayar;
        }
      } catch (err) {
        console.error('Failed to parse date for daily trend:', err);
      }
    });

    return Object.values(trendMap).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [data?.list]);

  // Calculate average daily utilization of all TVs across 30 days
  const tvDailyTrendData = useMemo(() => {
    if (!data?.list) return [];
    
    const dates: string[] = [];
    const trendData: any[] = [];
    
    // Create entries for the last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const name = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      
      const dayRecord: any = {
        tanggal: dateStr,
        name,
        overall: 0,
      };
      for (let tvId = 1; tvId <= 8; tvId++) {
        dayRecord[`tv_${tvId}`] = 0;
      }
      trendData.push(dayRecord);
    }

    // Populate data
    data.list.forEach(trx => {
      try {
        const dateStr = trx.tanggal_transaksi.split('T')[0];
        const found = trendData.find(item => item.tanggal === dateStr);
        if (found && trx.id_tv) {
          const minutes = trx.durasi_menit || Math.max(1, Math.round(trx.total_sewa / 166.67));
          found[`tv_${trx.id_tv}`] += minutes;
        }
      } catch (e) {
        console.error('Error parsing TV daily trend:', e);
      }
    });

    // Calculate percentages (capped at 100%) and overall average
    trendData.forEach(item => {
      let sumPercentages = 0;
      for (let tvId = 1; tvId <= 8; tvId++) {
        const minutes = item[`tv_${tvId}`];
        const pct = Math.min(100, Math.round((minutes / 720) * 100 * 10) / 10); // 12 hours = 720 mins
        item[`tv_${tvId}`] = pct;
        sumPercentages += pct;
      }
      item.overall = Math.round((sumPercentages / 8) * 10) / 10;
    });

    return trendData;
  }, [data?.list]);

  // Calculate period-based TV utilization stats
  const tvUtilizationStats = useMemo(() => {
    let daysCount = 1;
    if (period === 'this_week') {
      daysCount = 7;
    } else if (period === 'this_month') {
      daysCount = 30;
    } else if (period === 'all') {
      if (data?.list && data.list.length > 0) {
        const uniqueDays = new Set(data.list.map(t => t.tanggal_transaksi.split('T')[0]));
        daysCount = Math.max(1, uniqueDays.size);
      } else {
        daysCount = 30;
      }
    }

    const stats: Record<number, { id_tv: number; nama_tv: string; total_menit: number; total_transaksi: number; total_sewa: number }> = {};
    for (let tvId = 1; tvId <= 8; tvId++) {
      stats[tvId] = {
        id_tv: tvId,
        nama_tv: `TV-0${tvId}`,
        total_menit: 0,
        total_transaksi: 0,
        total_sewa: 0
      };
    }

    filteredList.forEach(trx => {
      if (trx.id_tv && stats[trx.id_tv]) {
        const minutes = trx.durasi_menit || Math.max(1, Math.round(trx.total_sewa / 166.67));
        stats[trx.id_tv].total_menit += minutes;
        stats[trx.id_tv].total_transaksi += 1;
        stats[trx.id_tv].total_sewa += trx.total_sewa;
      }
    });

    return Object.values(stats).map(item => {
      const avgMinutesPerDay = item.total_menit / daysCount;
      const utilizationPct = Math.min(100, Math.round((avgMinutesPerDay / 720) * 100 * 10) / 10);
      return {
        ...item,
        utilizationPct,
        avgHoursPerDay: Math.round((avgMinutesPerDay / 60) * 10) / 10,
        totalHours: Math.round((item.total_menit / 60) * 10) / 10
      };
    });
  }, [filteredList, period, data?.list]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Tidak ada data', text: 'Belum ada transaksi untuk diekspor.' });
      return;
    }
    
    const headers = ['ID Transaksi', 'ID Billing', 'Waktu', 'Sewa TV', 'Konsumsi', 'Total Bayar', 'Metode Pembayaran'];
    const rows = filteredList.map(trx => [
      trx.id_transaksi,
      trx.id_billing,
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
    link.setAttribute("download", `laporan_transaksi_${period}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  // Handle Download PDF
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const primaryColor = [99, 102, 241]; // Indigo #6366f1
      const darkColor = [15, 23, 42]; // Slate 900 #0f172a
      const textColor = [51, 65, 85]; // Slate 700
      const accentColor = [245, 158, 11]; // Amber #f59e0b

      // Page Setup
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Header Banner
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(0, 0, pageWidth, 45, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('SUMO PLAYSTATION & CAFE', 15, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(194, 205, 218);
      doc.text('Laporan Analisis & Statistik Pendapatan', 15, 25);

      // Period and Date Info
      const periodLabel = period === 'all' ? 'Semua Waktu' :
                          period === 'today' ? 'Hari Ini' :
                          period === 'this_week' ? '7 Hari Terakhir' : 'Bulan Ini';
      doc.text(`Periode: ${periodLabel}`, pageWidth - 15, 18, { align: 'right' });
      doc.text(`Dibuat: ${new Date().toLocaleString('id-ID')}`, pageWidth - 15, 25, { align: 'right' });

      // Subtitle separator line
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(1);
      doc.line(15, 34, pageWidth - 15, 34);

      let currentY = 55;

      // 1. Ringkasan Finansial Section
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('1. RINGKASAN FINANSIAL', 15, currentY);
      currentY += 8;

      // Draw cards or summary table
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      
      const boxWidth = (pageWidth - 30 - 9) / 4; // 4 boxes with 3mm gap
      const boxHeight = 22;
      const stats = [
        { label: 'Pendapatan Hari Ini', val: `Rp ${activeSummary.todayIncome.toLocaleString('id-ID')}` },
        { label: 'Sewa PlayStation', val: `Rp ${activeSummary.rentIncome.toLocaleString('id-ID')}` },
        { label: 'Pemesanan Menu', val: `Rp ${activeSummary.menuIncome.toLocaleString('id-ID')}` },
        { label: 'Total Pendapatan', val: `Rp ${activeSummary.totalIncome.toLocaleString('id-ID')}` }
      ];

      stats.forEach((stat, idx) => {
        const x = 15 + idx * (boxWidth + 3);
        // Box
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(x, currentY, boxWidth, boxHeight, 'FD');
        
        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(stat.label, x + boxWidth / 2, currentY + 6, { align: 'center' });
        
        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(stat.val, x + boxWidth / 2, currentY + 14, { align: 'center' });
      });

      currentY += boxHeight + 15;

      // 2. Monthly Income Breakdown
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('2. TREN PENDAPATAN BULANAN', 15, currentY);
      currentY += 8;

      // Table Header for Monthly Data
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(15, currentY, pageWidth - 30, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Bulan', 18, currentY + 5.5);
      doc.text('Sewa PlayStation', 70, currentY + 5.5, { align: 'right' });
      doc.text('Konsumsi Cafe', 120, currentY + 5.5, { align: 'right' });
      doc.text('Total Omset', 180, currentY + 5.5, { align: 'right' });
      
      currentY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      if (monthlyData.length === 0) {
        doc.rect(15, currentY, pageWidth - 30, 10);
        doc.text('Belum ada data transaksi bulanan.', pageWidth / 2, currentY + 6, { align: 'center' });
        currentY += 10;
      } else {
        monthlyData.forEach((row, idx) => {
          // Zebra striping
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, currentY, pageWidth - 30, 8, 'F');
          }
          doc.rect(15, currentY, pageWidth - 30, 8, 'D');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFont('helvetica', 'semibold');
          doc.text(row.name, 18, currentY + 5.5);
          doc.setFont('helvetica', 'normal');
          doc.text(`Rp ${row.sewa.toLocaleString('id-ID')}`, 70, currentY + 5.5, { align: 'right' });
          doc.text(`Rp ${row.menu.toLocaleString('id-ID')}`, 120, currentY + 5.5, { align: 'right' });
          doc.setFont('helvetica', 'bold');
          doc.text(`Rp ${row.total.toLocaleString('id-ID')}`, 180, currentY + 5.5, { align: 'right' });
          
          currentY += 8;
        });
      }

      currentY += 15;

      // Check if page overflow
      if (currentY > pageHeight - 80) {
        doc.addPage();
        currentY = 25;
      }

      // 3. Top Selling Items Menu
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('3. MENU TERLARIS (TOP 5)', 15, currentY);
      currentY += 8;

      // Table Header for Popular Menus
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(15, currentY, pageWidth - 30, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Nama Menu / Item', 18, currentY + 5.5);
      doc.text('Kuantitas Terjual', 100, currentY + 5.5, { align: 'center' });
      doc.text('Total Revenue', 180, currentY + 5.5, { align: 'right' });

      currentY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      if (popularMenus.length === 0) {
        doc.rect(15, currentY, pageWidth - 30, 10);
        doc.text('Belum ada menu yang terjual.', pageWidth / 2, currentY + 6, { align: 'center' });
        currentY += 10;
      } else {
        popularMenus.forEach((menu, idx) => {
          // Zebra striping
          if (idx % 2 === 1) {
            doc.setFillColor(254, 243, 199); // Amber-100 style
            doc.rect(15, currentY, pageWidth - 30, 8, 'F');
          }
          doc.rect(15, currentY, pageWidth - 30, 8, 'D');
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.setFont('helvetica', 'semibold');
          doc.text(menu.nama, 18, currentY + 5.5);
          doc.setFont('helvetica', 'bold');
          doc.text(`${menu.qty} Porsi / Item`, 100, currentY + 5.5, { align: 'center' });
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 83, 9); // Amber-700
          doc.text(`Rp ${menu.revenue.toLocaleString('id-ID')}`, 180, currentY + 5.5, { align: 'right' });
          
          currentY += 8;
        });
      }

      // Footer signature & note
      currentY = Math.max(currentY + 20, pageHeight - 30);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, currentY, pageWidth - 15, currentY);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Sistem Kasir & Rental Sumo PlayStation - Laporan otomatis diunduh secara aman.', 15, currentY + 5);
      doc.text(`Halaman 1 dari 1`, pageWidth - 15, currentY + 5, { align: 'right' });

      doc.save(`Laporan_Bulanan_SumoPS_${new Date().toISOString().split('T')[0]}.pdf`);
      
      Swal.fire({
        icon: 'success',
        title: 'PDF Diunduh',
        text: 'Laporan bulanan & menu terlaris berhasil diekspor ke PDF!',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunduh PDF',
        text: err.message || 'Terjadi kesalahan saat membuat PDF.'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 font-mono text-xs">
        Memuat data analisis & statistik...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-950 border border-rose-800 text-rose-300 rounded-2xl text-xs">
        {error}
      </div>
    );
  }

  if (!data || !activeSummary) return null;

  const { chartData, popularMenus } = data;

  // Render SVG Line Chart math
  const padding = 40;
  const chartWidth = 500;
  const chartHeight = 200;
  
  const points = chartData.map((d, index) => {
    const x = padding + (index * (chartWidth - padding * 2)) / (chartData.length - 1 || 1);
    const maxVal = Math.max(...chartData.map(c => c.total), 100000);
    const y = chartHeight - padding - (d.total * (chartHeight - padding * 2)) / maxVal;
    return { x, y, val: d.total, date: d.tanggal };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : '';

  return (
    <div className="space-y-6" ref={printRef}>
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-950/40 border border-indigo-800 text-indigo-400 rounded-lg">
            <Filter className="w-4 h-4" />
          </div>
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value as FilterPeriod)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="all">Semua Waktu</option>
            <option value="today">Hari Ini</option>
            <option value="this_week">7 Hari Terakhir</option>
            <option value="this_month">Bulan Ini</option>
          </select>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4" />
            Ekspor CSV
          </button>
          <button 
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            <FileText className="w-4 h-4" />
            Unduh PDF
          </button>
          <button 
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* 1. Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Income */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden print:border-slate-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider print:text-slate-600">Pendapatan Hari Ini</span>
              <h3 className="text-2xl font-bold font-display text-white tracking-tight mt-1 print:text-slate-900">
                Rp {activeSummary.todayIncome.toLocaleString('id-ID')}
              </h3>
            </div>
            <span className="p-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-xl print:hidden">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-3">Diperbarui real-time</div>
        </div>

        {/* Total Rent Income */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden print:border-slate-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider print:text-slate-600">Sewa PlayStation</span>
              <h3 className="text-2xl font-bold font-display text-white tracking-tight mt-1 print:text-slate-900">
                Rp {activeSummary.rentIncome.toLocaleString('id-ID')}
              </h3>
            </div>
            <span className="p-2.5 bg-indigo-950/40 border border-indigo-800 text-indigo-400 rounded-xl print:hidden">
              <Tv className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-3">Sesuai filter ({period})</div>
        </div>

        {/* Total Menu Income */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden print:border-slate-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider print:text-slate-600">Pemesanan Menu</span>
              <h3 className="text-2xl font-bold font-display text-white tracking-tight mt-1 print:text-slate-900">
                Rp {activeSummary.menuIncome.toLocaleString('id-ID')}
              </h3>
            </div>
            <span className="p-2.5 bg-amber-950/40 border border-amber-800 text-amber-400 rounded-xl print:hidden">
              <Utensils className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-3">Sesuai filter ({period})</div>
        </div>

        {/* Total Profit */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden print:border-slate-300">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider print:text-slate-600">Total Pendapatan</span>
              <h3 className="text-2xl font-bold font-display text-white tracking-tight mt-1 print:text-slate-900">
                Rp {activeSummary.totalIncome.toLocaleString('id-ID')}
              </h3>
            </div>
            <span className="p-2.5 bg-purple-950/40 border border-purple-800 text-purple-400 rounded-xl print:hidden">
              <ArrowUpRight className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-3">Trx Berhasil: {activeSummary.totalTrxCount}</div>
        </div>
      </div>

      {/* 2. Visual Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* SVG Line Chart for 7 Days Trend */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
            <LineChartIcon className="w-4 h-4 text-indigo-400" />
            Tren Pendapatan (7 Hari Terakhir)
          </h3>
          <div className="w-full relative h-[210px] flex items-center justify-center">
            {chartData.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada transaksi.</p>
            ) : (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                  const yVal = padding + r * (chartHeight - padding * 2);
                  return (
                    <line
                      key={i}
                      x1={padding}
                      y1={yVal}
                      x2={chartWidth - padding}
                      y2={yVal}
                      stroke="#1e293b"
                      strokeDasharray="4"
                    />
                  );
                })}
                {/* Area under curve */}
                <path d={areaPath} fill="url(#gradient)" />
                {/* Line Curve */}
                <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" />
                {/* Points */}
                {points.map((p, i) => (
                  <g key={i} className="group">
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      className="fill-indigo-400 stroke-slate-900 stroke-2 cursor-pointer hover:r-6 transition-all"
                    />
                    {/* Tooltip on dot */}
                    <text
                      x={p.x}
                      y={p.y - 10}
                      textAnchor="middle"
                      className="fill-slate-100 font-mono text-[9px] font-bold bg-slate-950 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Rp {(p.val / 1000).toFixed(0)}k
                    </text>
                  </g>
                ))}
                {/* Axis dates */}
                {points.map((p, i) => {
                  const dateShort = new Date(p.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                  return (
                    <text
                      key={i}
                      x={p.x}
                      y={chartHeight - 15}
                      textAnchor="middle"
                      className="fill-slate-400 font-mono text-[8px]"
                    >
                      {dateShort}
                    </text>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Popular Menu sales bar chart */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Menu Terlaris (Top 5)
          </h3>
          <div className="space-y-4">
            {popularMenus.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">Belum ada menu yang terjual.</p>
            ) : (
              popularMenus.map((menu, idx) => {
                const maxQty = Math.max(...popularMenus.map(m => m.qty), 1);
                const percent = (menu.qty / maxQty) * 100;
                return (
                  <div key={idx} className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-200">{menu.nama}</span>
                      <span className="text-amber-400 font-mono font-bold">{menu.qty} terjual</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-800/80 h-3 rounded-lg overflow-hidden relative">
                      <div
                        className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-lg transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <p className="text-[9px] text-slate-500 text-right font-mono">
                      Omset: Rp {menu.revenue.toLocaleString('id-ID')}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2.2 30-Day Daily Revenue Trend Chart (Recharts Area/Line Chart) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
              <LineChartIcon className="w-4 h-4 text-indigo-400" />
              Tren Pendapatan Harian (30 Hari Terakhir)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Grafik pergerakan harian untuk memantau fluktuasi omset sewa PS, konsumsi cafe, dan total pendapatan secara detail.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Sewa
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Kafe
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-500"></span> Total
            </span>
          </div>
        </div>

        <div className="w-full h-[300px] pt-4">
          {dailyTrend30Days.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 font-mono">
              Belum ada data transaksi harian untuk 30 hari terakhir.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dailyTrend30Days}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="totalIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                  interval={Math.ceil(dailyTrend30Days.length / 10)}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false}
                  dx={-5}
                  tickFormatter={(value) => `Rp ${value >= 1000000 ? `${(value / 1000000).toFixed(1)}jt` : `${(value / 1000).toFixed(0)}rb`}`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  name="Total Pendapatan" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#totalIncomeGrad)" 
                />
                <Line 
                  type="monotone" 
                  dataKey="sewa" 
                  name="Sewa PS" 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="menu" 
                  name="Konsumsi Cafe" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4 }} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2.5 Monthly Revenue Trend Chart (Recharts) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
              <BarChartIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
              Laporan Tren Pendapatan Bulanan
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Grafik interaktif pembagian omset sewa PlayStation dan pesanan kafe/makanan dari bulan ke bulan.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Sewa
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Kafe
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-500"></span> Total
            </span>
          </div>
        </div>

        <div className="w-full h-[320px] pt-4">
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 font-mono">
              Belum ada riwayat transaksi bulanan yang terekam.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  dx={-5}
                  tickFormatter={(value) => `Rp ${value >= 1000000 ? `${(value / 1000000).toFixed(1)}jt` : `${(value / 1000).toFixed(0)}rb`}`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}
                />
                <Bar 
                  dataKey="sewa" 
                  name="Biaya Sewa" 
                  stackId="a" 
                  fill="#6366f1" 
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="menu" 
                  name="Konsumsi Cafe" 
                  stackId="a" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  name="Total Pendapatan" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2, fill: '#0f172a' }} 
                  activeDot={{ r: 6 }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2.7 Analisis Utilisasi Konsol TV */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Left Side: Horizontal Bar Chart - Average Daily Utilization per TV */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Percent className="w-4 h-4 text-indigo-400" />
                Rata-Rata Utilisasi TV
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Rata-rata tingkat pemakaian per hari pada periode ini (asumsi 12 jam/hari).
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {tvUtilizationStats.every(s => s.total_transaksi === 0) ? (
              <p className="text-xs text-slate-500 py-12 text-center">Belum ada pemakaian konsol TV pada periode ini.</p>
            ) : (
              tvUtilizationStats.map((stat) => (
                <div key={stat.id_tv} className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-slate-400" />
                      {stat.nama_tv}
                    </span>
                    <span className="text-indigo-400 font-mono font-bold">
                      {stat.utilizationPct}% <span className="text-slate-500 font-normal text-[10px]">({stat.avgHoursPerDay}h/day)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 border border-slate-800/80 h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${stat.utilizationPct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>Sewa: {stat.total_transaksi}x</span>
                    <span>Total: {stat.totalHours} jam (Rp {stat.total_sewa.toLocaleString('id-ID')})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Line/Area Chart - Daily Utilization Trend over 30 Days with TV Selector dropdown */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-2 space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Clock className="w-4 h-4 text-emerald-400" />
                Tren Utilisasi Harian (30 Hari Terakhir)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pantau pergerakan okupansi harian per konsol untuk mendeteksi jam sibuk dan favorit pelanggan.
              </p>
            </div>
            <div>
              <select
                value={selectedTvTrend}
                onChange={(e) => setSelectedTvTrend(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 font-mono"
              >
                <option value="overall">Semua TV (Rata-rata)</option>
                <option value="tv_1">TV-01</option>
                <option value="tv_2">TV-02</option>
                <option value="tv_3">TV-03</option>
                <option value="tv_4">TV-04</option>
                <option value="tv_5">TV-05</option>
                <option value="tv_6">TV-06</option>
                <option value="tv_7">TV-07</option>
                <option value="tv_8">TV-08</option>
              </select>
            </div>
          </div>

          <div className="w-full h-[280px] pt-4">
            {tvDailyTrendData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-500 font-mono">
                Belum ada data transaksi harian untuk visualisasi tren.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={tvDailyTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="tvTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity="0.25"/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                    interval={Math.ceil(tvDailyTrendData.length / 10)}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    dx={-5}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTVTrendTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey={selectedTvTrend} 
                    name={selectedTvTrend === 'overall' ? 'Rata-rata Semua TV' : `TV-0${selectedTvTrend.split('_')[1]}`} 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#tvTrendGrad)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 3. Historical Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 print:border-slate-300 print:bg-white print:text-black">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display print:text-black">
          <FileText className="w-4 h-4 text-indigo-400 print:hidden" />
          Riwayat Laporan Transaksi ({period})
        </h3>

        <div className="overflow-x-auto border border-slate-800 rounded-xl print:border-slate-300">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider print:bg-slate-100 print:text-black print:border-slate-300">
                <th className="p-3">ID Trx</th>
                <th className="p-3">TV</th>
                <th className="p-3 text-right">Biaya Sewa</th>
                <th className="p-3 text-right">Biaya Menu</th>
                <th className="p-3 text-right">Total Bayar</th>
                <th className="p-3 text-center">Metode</th>
                <th className="p-3 text-right">Waktu Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 print:divide-slate-200 print:text-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">Belum ada riwayat transaksi pada periode ini.</td>
                </tr>
              ) : (
                filteredList.map((trx) => (
                  <tr key={trx.id_transaksi} className="hover:bg-slate-950/20 print:hover:bg-transparent">
                    <td className="p-3 font-mono font-bold text-slate-400 text-[11px] print:text-slate-700">{trx.id_transaksi}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-black">{trx.id_tv ? `TV-0${trx.id_tv}` : 'Sistem'}</td>
                    <td className="p-3 text-right font-mono text-slate-300 print:text-slate-800">Rp {trx.total_sewa.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right font-mono text-amber-500/80 print:text-slate-800">Rp {trx.total_menu.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm print:text-black">Rp {trx.total_bayar.toLocaleString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border font-bold print:border-slate-300 print:text-black print:bg-transparent ${
                        trx.metode_pembayaran === 'cash' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' :
                        trx.metode_pembayaran === 'qris' ? 'bg-indigo-950/40 border-indigo-800 text-indigo-400' :
                        'bg-amber-950/40 border-amber-800 text-amber-400'
                      }`}>
                        {trx.metode_pembayaran}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400 text-[11px] print:text-slate-600">
                      {new Date(trx.tanggal_transaksi).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

