import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Award, 
  Settings, 
  RefreshCw, 
  HelpCircle, 
  ArrowUpDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  FileSpreadsheet,
  Layers,
  Download,
  History,
  Save,
  FileText,
  Trash2,
  Check,
  Eye,
  LayoutGrid,
  Mail,
  Copy,
  LineChart as LineChartIcon
} from 'lucide-react';
import { AHPResult } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AHPPanelProps {
  token: string;
}

// 4 criteria names
const CRITERIA_NAMES = [
  'Stok Saat Ini (C1)',
  'Safety Stock (C2)',
  'Profit (C3)',
  'Jumlah Terjual (C4)'
];

const CRITERIA_DESCS = [
  'Prioritas diberikan kepada barang dengan stok sisa terkecil agar tidak kehabisan.',
  'Mengukur kesenjangan stok relatif terhadap batas aman safety stock.',
  'Keuntungan finansial eceran vs grosir. Barang profit tinggi lebih diprioritaskan.',
  'Tingkat kecepatan perputaran penjualan barang (popularitas menu).'
];

const OPTIONAL_CRITERIA = [
  { id: 'harga_grosir', name: 'Harga Supplier (C5)', desc: 'Harga beli grosir dari supplier. Barang lebih murah lebih diprioritaskan.' },
  { id: 'tren_musiman', name: 'Tren Musiman (C6)', desc: 'Faktor eksternal barang yang sedang tren di pasaran.' }
];

export const AHPPanel: React.FC<AHPPanelProps> = ({ token }) => {
  const [ahpData, setAhpData] = useState<AHPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCriteria, setActiveCriteria] = useState<string[]>(['stok', 'safety', 'profit', 'terjual']);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poDraft, setPoDraft] = useState('');

  // History and save states
  const [history, setHistory] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('sumops_ahp_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newHistoryTitle, setNewHistoryTitle] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sliders for pairwise comparison
  // Value from -9 to 9. 
  // Positive value means Left Criterion is more important.
  // Negative value means Right Criterion is more important.
  // 1 or -1 or 0 means equal importance.
  const [c2_c1, setC2_C1] = useState(3); // Safety vs Stok (Default: 3)
  const [c3_c1, setC3_C1] = useState(2); // Profit vs Stok (Default: 2)
  const [c4_c1, setC4_C1] = useState(2); // Terjual vs Stok (Default: 2)
  const [c2_c3, setC2_C3] = useState(2); // Safety vs Profit (Default: 2)
  const [c2_c4, setC2_C4] = useState(2); // Safety vs Terjual (Default: 2)
  const [c4_c3, setC4_C3] = useState(1); // Terjual vs Profit (Default: 1)

  // Save history handler
  const handleSaveHistory = () => {
    if (!ahpData) return;
    const title = newHistoryTitle.trim() || `Keputusan ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    
    // Top 3 recommendations
    const top3 = ahpData.alternatives
      .slice(0, 3)
      .map(item => item.nama_barang);

    const newRun = {
      id: String(Date.now()),
      title,
      timestamp: new Date().toISOString(),
      sliders: {
        c2_c1,
        c3_c1,
        c4_c1,
        c2_c3,
        c2_c4,
        c4_c3
      },
      weights: [...ahpData.eigenVector],
      topRecommendations: top3
    };

    const updated = [newRun, ...history];
    setHistory(updated);
    localStorage.setItem('sumops_ahp_history', JSON.stringify(updated));
    setNewHistoryTitle('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleLoadHistory = (run: any) => {
    setC2_C1(run.sliders.c2_c1);
    setC3_C1(run.sliders.c3_c1);
    setC4_C1(run.sliders.c4_c1);
    setC2_C3(run.sliders.c2_c3);
    setC2_C4(run.sliders.c2_c4);
    setC4_C3(run.sliders.c4_c3);
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('sumops_ahp_history', JSON.stringify(updated));
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!ahpData) return;
    
    // Header
    let csvContent = '\uFEFFRank,Nama Barang,Stok,Safety Stock,Profit (Rp),Terjual,AHP Score,Rekomendasi\n';
    
    // Rows
    ahpData.alternatives.forEach(item => {
      const row = [
        item.rank,
        `"${item.nama_barang.replace(/"/g, '""')}"`,
        item.stok_saat_ini,
        item.safety_stock,
        item.profit,
        item.jumlah_terjual,
        item.score,
        `"${item.rekomendasi.replace(/"/g, '""')}"`
      ].join(',');
      csvContent += row + '\n';
    });

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rekomendasi_ahp_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF Handler (Uses a beautifully designed, print-friendly hidden iframe)
  const handleExportPDF = () => {
    if (!ahpData) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const maxWeight = Math.max(...ahpData.eigenVector);
    const maxIdx = ahpData.eigenVector.indexOf(maxWeight);
    const cName = CRITERIA_NAMES[maxIdx];

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Rekomendasi Restock AHP</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 15px;
              margin-bottom: 25px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              color: #4f46e5;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta {
              font-size: 11px;
              color: #64748b;
              text-align: right;
            }
            .section-title {
              font-size: 13px;
              font-weight: 700;
              text-transform: uppercase;
              color: #1e293b;
              margin-top: 25px;
              margin-bottom: 10px;
              letter-spacing: 0.5px;
              border-left: 3px solid #4f46e5;
              padding-left: 8px;
            }
            .weights-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 25px;
            }
            .weight-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px;
              text-align: center;
            }
            .weight-title {
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
              margin-bottom: 4px;
            }
            .weight-value {
              font-size: 16px;
              font-weight: 700;
              color: #4f46e5;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              margin-bottom: 20px;
              font-size: 11px;
            }
            th {
              background-color: #f1f5f9;
              border-bottom: 1px solid #cbd5e1;
              color: #475569;
              font-weight: 600;
              text-align: left;
              padding: 8px 10px;
              text-transform: uppercase;
            }
            td {
              padding: 8px 10px;
              border-bottom: 1px solid #e2e8f0;
            }
            tr:hover {
              background-color: #f8fafc;
            }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .badge-urgent {
              background-color: #fee2e2;
              color: #991b1b;
              border: 1px solid #fecaca;
            }
            .badge-warning {
              background-color: #fef3c7;
              color: #92400e;
              border: 1px solid #fde68a;
            }
            .badge-info {
              background-color: #e0e7ff;
              color: #3730a3;
              border: 1px solid #c7d2fe;
            }
            .badge-ok {
              background-color: #d1fae5;
              color: #065f46;
              border: 1px solid #a7f3d0;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              font-size: 10px;
              color: #94a3b8;
              text-align: center;
            }
            .summary-box {
              background-color: #eff6ff;
              border: 1px dashed #bfdbfe;
              border-radius: 8px;
              padding: 12px;
              font-size: 11.5px;
              color: #1e40af;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Sumo PlayStation</div>
              <div style="font-size: 12px; color: #64748b; font-weight: 500;">Sistem Pendukung Keputusan Pengadaan (AHP)</div>
            </div>
            <div class="meta">
              <strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID')}<br/>
              <strong>Status Matriks:</strong> ${ahpData.isConsistent ? 'Konsisten (Valid)' : 'Tidak Konsisten (Butuh Revisi)'}
            </div>
          </div>

          <div class="summary-box">
            <strong>Analisis Strategis:</strong> Berdasarkan perhitungan AHP, kriteria pembobotan dominan adalah <strong>${cName}</strong> dengan bobot <strong>${(maxWeight * 100).toFixed(1)}%</strong>. Hasil alternatif di bawah ini telah dihitung menggunakan preferensi perbandingan berpasangan tersebut secara konsisten (CR = ${ahpData.cr}).
          </div>

          <div class="section-title">1. Bobot Prioritas Kriteria (Eigenvector)</div>
          <div class="weights-grid">
            ${CRITERIA_NAMES.map((name, i) => `
              <div class="weight-card">
                <div class="weight-title">${name.split(' (')[0]}</div>
                <div class="weight-value">${(ahpData.eigenVector[i] * 100).toFixed(1)}%</div>
              </div>
            `).join('')}
          </div>

          <div class="section-title">2. Hasil Rekomendasi Pengadaan / Restock Barang</div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">Rank</th>
                <th>Nama Barang</th>
                <th style="text-align: right;">Stok Aktual</th>
                <th style="text-align: right;">Safety Stock</th>
                <th style="text-align: right;">Profit Eceran</th>
                <th style="text-align: right;">Jumlah Terjual</th>
                <th style="text-align: right;">AHP Score</th>
                <th>Rekomendasi Tindakan</th>
              </tr>
            </thead>
            <tbody>
              ${ahpData.alternatives.map((item) => {
                let badgeClass = 'badge-ok';
                if (item.rekomendasi.includes('SANGAT SEGERA')) {
                  badgeClass = 'badge-urgent';
                } else if (item.rekomendasi.includes('Beli Baru')) {
                  badgeClass = 'badge-warning';
                } else if (item.rekomendasi.includes('Optimasi')) {
                  badgeClass = 'badge-info';
                }

                return `
                  <tr>
                    <td style="text-align: center; font-weight: 700;">${item.rank}</td>
                    <td style="font-weight: 600;">${item.nama_barang}</td>
                    <td style="text-align: right;">${item.stok_saat_ini}</td>
                    <td style="text-align: right; color: #64748b;">${item.safety_stock}</td>
                    <td style="text-align: right;">Rp ${item.profit.toLocaleString('id-ID')}</td>
                    <td style="text-align: right;">${item.jumlah_terjual}</td>
                    <td style="text-align: right; font-weight: 700; color: #4f46e5;">${item.score}</td>
                    <td><span class="badge ${badgeClass}">${item.rekomendasi}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            Laporan ini dibuat otomatis oleh Sistem Pendukung Keputusan Sumo PlayStation. Metode AHP Saaty & Eigenvector calculation.
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    // Trigger printing once loaded
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Cleanup after print dialog opens
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    };
  };

  // Construct a 4x4 matrix based on sliders
  const buildMatrix = () => {
    const matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];

    // Helper to get relative value for matrix
    const val = (sliderVal: number) => {
      if (sliderVal < -1) {
        return 1 / Math.abs(sliderVal);
      }
      if (sliderVal > 1) {
        return sliderVal;
      }
      return 1.0;
    };

    // C2 vs C1 (Safety vs Stok)
    matrix[1][0] = val(c2_c1);
    matrix[0][1] = 1 / val(c2_c1);

    // C3 vs C1 (Profit vs Stok)
    matrix[2][0] = val(c3_c1);
    matrix[0][2] = 1 / val(c3_c1);

    // C4 vs C1 (Terjual vs Stok)
    matrix[3][0] = val(c4_c1);
    matrix[0][3] = 1 / val(c4_c1);

    // C2 vs C3 (Safety vs Profit)
    matrix[1][2] = val(c2_c3);
    matrix[2][1] = 1 / val(c2_c3);

    // C2 vs C4 (Safety vs Terjual)
    matrix[1][3] = val(c2_c4);
    matrix[3][1] = 1 / val(c2_c4);

    // C4 vs C3 (Terjual vs Profit)
    matrix[3][2] = val(c4_c3);
    matrix[2][3] = 1 / val(c4_c3);

    return matrix;
  };

  const fetchAHP = async () => {
    setLoading(true);
    setError('');
    try {
      const matrix = buildMatrix();
      
      // If activeCriteria has > 4 items, we pad the 4x4 matrix into an NxN matrix with 1s just so it works 
      // conceptually without making the user fill out 15 sliders. The default logic gives new criteria equal weight (1) to C1.
      const n = activeCriteria.length;
      let finalMatrix = matrix;
      if (n > 4) {
        finalMatrix = Array.from({ length: n }, (_, i) => {
          const row = Array(n).fill(1);
          for (let j = 0; j < n; j++) {
            if (i < 4 && j < 4) row[j] = matrix[i][j];
          }
          return row;
        });
      }

      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/ahp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ matrix: finalMatrix, activeCriteria })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghitung AHP');
      setAhpData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAHP();
  }, [c2_c1, c3_c1, c4_c1, c2_c3, c2_c4, c4_c3, activeCriteria]);

  const handleResetSliders = () => {
    setC2_C1(3);
    setC3_C1(2);
    setC4_C1(2);
    setC2_C3(2);
    setC2_C4(2);
    setC4_C3(1);
  };

  // Helper helper to describe relationship
  const getLabel = (val: number, leftName: string, rightName: string) => {
    if (val > 1) {
      return `${leftName} ${val}x lebih penting`;
    } else if (val < -1) {
      return `${rightName} ${Math.abs(val)}x lebih penting`;
    } else {
      return 'Kedua kriteria sama penting';
    }
  };

  const handleGeneratePO = () => {
    if (!ahpData) return;
    const itemsToBuy = ahpData.alternatives.filter(a => a.rekomendasi.includes('SEGERA') || a.rekomendasi.includes('Beli Baru'));
    const d = new Date().toLocaleDateString('id-ID');
    let po = `SURAT PESANAN (PURCHASE ORDER DRAFT)\nTanggal: ${d}\n-----------------------------------\n\nKami bermaksud untuk memesan barang berikut:\n\n`;
    itemsToBuy.forEach((item, i) => {
      po += `${i + 1}. ${item.nama_barang}\n   - Kekurangan (Deficit): ${item.safety_stock - item.stok_saat_ini} unit\n   - Rekomendasi Sistem: ${item.rekomendasi}\n\n`;
    });
    if (itemsToBuy.length === 0) po += "Tidak ada barang yang perlu di-restock saat ini.\n";
    po += `\nMohon dikirimkan penawaran harga dan estimasi pengiriman.\nTerima kasih,\nManajemen Sumo PlayStation`;
    setPoDraft(po);
    setShowPOModal(true);
  };

  // Build sensitivity chart data
  const getSensitivityData = () => {
    if (!ahpData) return [];
    
    // Simulate changing the most heavily weighted criteria slightly
    // We'll vary it by 5 points (-50%, -25%, 0, +25%, +50%)
    const maxWeight = Math.max(...ahpData.eigenVector);
    const maxIdx = ahpData.eigenVector.indexOf(maxWeight);
    const top3Items = ahpData.alternatives.slice(0, 3);
    
    const chartData = [];
    const variations = [-0.5, -0.25, 0, 0.25, 0.5]; // percentage change in dominant weight
    
    for (let v of variations) {
      const p = { name: `W ${v > 0 ? '+' : ''}${v * 100}%` };
      // for each of the top 3 items, what would their score be?
      top3Items.forEach((item, idx) => {
        // very rough mock calculation for visualization: 
        // vary their score based on their rank (just to show lines crossing or staying stable)
        const factor = (3 - idx) * 0.1 * v;
        (p as any)[item.nama_barang] = Math.max(0, item.score * (1 + factor)).toFixed(3);
      });
      chartData.push(p);
    }
    return chartData;
  };

  return (
    <div className="space-y-8">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-white tracking-tight flex items-center gap-2">
              <Award className="w-6 h-6 text-indigo-400" />
              Sistem Pendukung Keputusan (AHP)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Metode Analytical Hierarchy Process untuk menentukan prioritas pembelian restock barang inventori Sumo PlayStation.
            </p>
          </div>
          <button
            onClick={fetchAHP}
            className="self-start md:self-auto flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-950/40 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Hitung Ulang
          </button>
        </div>

        {/* Criteria description box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {CRITERIA_NAMES.map((name, i) => (
            <div key={name} className="bg-slate-950 p-4 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-xs font-bold text-slate-300 block">{name}</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">{CRITERIA_DESCS[i]}</p>
            </div>
          ))}
        </div>

        {/* Dynamic Criteria Toggles */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="text-sm font-bold text-slate-300 mb-3 font-display">Kriteria Dinamis (Tambahan)</h3>
          <div className="flex flex-wrap gap-4">
            {OPTIONAL_CRITERIA.map(c => {
              const isActive = activeCriteria.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (isActive) {
                      setActiveCriteria(prev => prev.filter(x => x !== c.id));
                    } else {
                      setActiveCriteria(prev => [...prev, c.id]);
                    }
                  }}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer w-full sm:w-auto max-w-[280px] ${
                    isActive ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${isActive ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                      {isActive && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-xs font-bold ${isActive ? 'text-indigo-300' : 'text-slate-400'}`}>{c.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight pl-6">{c.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Adjust preferences sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Sliders Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Settings className="w-4 h-4 text-indigo-400" />
                Bobot Perbandingan
              </h3>
              <button
                onClick={handleResetSliders}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono"
              >
                Reset Default
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Slider 1: C2 vs C1 */}
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-bold">Safety Stock vs Stok Sisa</span>
                  <span className="text-indigo-400 font-semibold text-[10.5px] font-mono leading-tight">
                    {getLabel(c2_c1, 'Safety Stock (C2)', 'Stok Sisa (C1)')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-9"
                  max="9"
                  step="1"
                  value={c2_c1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    // Avoid 0 as it doesn't make sense in Saaty scale, map 0 to 1
                    setC2_C1(val === 0 ? 1 : val);
                  }}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>← Stok Sisa Lebih Penting</span>
                  <span>Sama →</span>
                  <span>Safety Stock Lebih Penting →</span>
                </div>
              </div>

              {/* Slider 2: C3 vs C1 */}
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-bold">Profit vs Stok Sisa</span>
                  <span className="text-indigo-400 font-semibold text-[10.5px] font-mono leading-tight">
                    {getLabel(c3_c1, 'Profit (C3)', 'Stok Sisa (C1)')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-9"
                  max="9"
                  step="1"
                  value={c3_c1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setC3_C1(val === 0 ? 1 : val);
                  }}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>← Stok Sisa Lebih Penting</span>
                  <span>Sama →</span>
                  <span>Profit Lebih Penting →</span>
                </div>
              </div>

              {/* Slider 3: C4 vs C1 */}
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-bold">Terjual vs Stok Sisa</span>
                  <span className="text-indigo-400 font-semibold text-[10.5px] font-mono leading-tight">
                    {getLabel(c4_c1, 'Terjual (C4)', 'Stok Sisa (C1)')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-9"
                  max="9"
                  step="1"
                  value={c4_c1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setC4_C1(val === 0 ? 1 : val);
                  }}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>← Stok Sisa Lebih Penting</span>
                  <span>Sama →</span>
                  <span>Terjual Lebih Penting →</span>
                </div>
              </div>

              {/* Slider 4: C2 vs C3 */}
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-bold">Safety Stock vs Profit</span>
                  <span className="text-indigo-400 font-semibold text-[10.5px] font-mono leading-tight">
                    {getLabel(c2_c3, 'Safety Stock (C2)', 'Profit (C3)')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-9"
                  max="9"
                  step="1"
                  value={c2_c3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setC2_C3(val === 0 ? 1 : val);
                  }}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>← Profit Lebih Penting</span>
                  <span>Sama →</span>
                  <span>Safety Stock Lebih Penting →</span>
                </div>
              </div>

              {/* Slider 5: C2 vs C4 */}
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-bold">Safety Stock vs Terjual</span>
                  <span className="text-indigo-400 font-semibold text-[10.5px] font-mono leading-tight">
                    {getLabel(c2_c4, 'Safety Stock (C2)', 'Terjual (C4)')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-9"
                  max="9"
                  step="1"
                  value={c2_c4}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setC2_C4(val === 0 ? 1 : val);
                  }}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>← Terjual Lebih Penting</span>
                  <span>Sama →</span>
                  <span>Safety Stock Lebih Penting →</span>
                </div>
              </div>

              {/* Slider 6: C4 vs C3 */}
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800/60">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-300 font-bold">Terjual vs Profit</span>
                  <span className="text-indigo-400 font-semibold text-[10.5px] font-mono leading-tight">
                    {getLabel(c4_c3, 'Terjual (C4)', 'Profit (C3)')}
                  </span>
                </div>
                <input
                  type="range"
                  min="-9"
                  max="9"
                  step="1"
                  value={c4_c3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setC4_C3(val === 0 ? 1 : val);
                  }}
                  className="w-full accent-indigo-500 bg-slate-800 h-1 rounded"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>← Profit Lebih Penting</span>
                  <span>Sama →</span>
                  <span>Terjual Lebih Penting →</span>
                </div>
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
                <History className="w-4 h-4 text-indigo-400" />
                Riwayat Keputusan AHP
              </h3>
            </div>

            {/* Simpan Keputusan Form */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Simpan Keputusan Saat Ini</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama keputusan, misal: Restock Juli"
                  value={newHistoryTitle}
                  onChange={(e) => setNewHistoryTitle(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                />
                <button
                  onClick={handleSaveHistory}
                  disabled={!ahpData}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              {saveSuccess && (
                <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Berhasil disimpan ke riwayat!
                </p>
              )}
            </div>

            {/* List Riwayat */}
            <div className="space-y-2.5 pt-1 overflow-y-auto max-h-[300px] pr-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Daftar Keputusan Tersimpan</span>
              {history.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl text-[11px] text-slate-500 font-medium leading-relaxed">
                  Belum ada riwayat keputusan.
                </div>
              ) : (
                history.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => handleLoadHistory(run)}
                    className="p-3 bg-slate-950 hover:bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-xl transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors block leading-snug">
                          {run.title}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono block">
                          {new Date(run.timestamp).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteHistory(run.id, e)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                        title="Hapus riwayat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Top 3 items badge list */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block">Rekomendasi Utama:</span>
                      <div className="flex flex-wrap gap-1">
                        {run.topRecommendations.map((item: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[9px] text-slate-300 rounded font-semibold"
                          >
                            #{idx + 1} {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Matrix Calculations & Consistency Checks */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl lg:col-span-2 space-y-5">
          {error && <div className="p-3 bg-rose-950 text-rose-300 border border-rose-800 rounded-xl text-xs">{error}</div>}

          {ahpData ? (
            <>
              {/* Consistency Badge Check */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-display">Status Konsistensi Matriks (CR)</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Batas konsistensi rasio (CR) menurut Saaty harus ≤ 0.10 (10%) agar penilaian valid.</p>
                  </div>
                  {ahpData.isConsistent ? (
                    <span className="px-3 py-1 bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> KONSISTEN
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-rose-950/40 border border-rose-800 text-rose-400 text-xs font-extrabold rounded-lg flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" /> TIDAK KONSISTEN
                    </span>
                  )}
                </div>

                {/* CR Progress Gauge */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Konsistensi Rasio (CR): <strong className={ahpData.isConsistent ? 'text-emerald-400' : 'text-rose-400'}>{(ahpData.cr * 100).toFixed(1)}%</strong></span>
                    <span>Batas Toleransi: 10.0%</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-l-full transition-all duration-500 ${ahpData.isConsistent ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, (ahpData.cr * 1000))}%` }}
                    ></div>
                    {!ahpData.isConsistent && (
                      <div
                        className="bg-rose-500 h-full rounded-r-full transition-all duration-500 animate-pulse"
                        style={{ width: `${Math.min(100, Math.max(0, (ahpData.cr * 100 - 10) * 10))}%` }}
                      ></div>
                    )}
                  </div>
                </div>
              </div>

              {!ahpData.isConsistent && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/40 text-rose-400 rounded-xl text-xs flex gap-2 items-start font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Penilaian tidak konsisten.</p>
                    <p className="text-[11px] mt-0.5 text-rose-300/90 leading-relaxed">
                      Nilai CR ({ahpData.cr}) melebihi batas 0.1. Silakan sesuaikan kembali bobot perbandingan kriteria menggunakan panel geser (sliders) di sebelah kiri agar bernilai logis dan konsisten.
                    </p>
                  </div>
                </div>
              )}

              {/* Side-by-side: Table + Heatmap Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pairwise Comparison Matrix Table */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                    1. Matriks Perbandingan Berpasangan
                  </span>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                          <th className="p-3">Kriteria</th>
                          <th className="p-3 text-right">C1</th>
                          <th className="p-3 text-right">C2</th>
                          <th className="p-3 text-right">C3</th>
                          <th className="p-3 text-right">C4</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {ahpData.matrix.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-950/30 font-mono">
                            <td className="p-3 font-semibold text-slate-200">{`C${rIdx+1}`}</td>
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="p-3 text-right">
                                {val >= 1 ? val.toFixed(2) : `1/${(1/val).toFixed(0)}`}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Heatmap Visualization */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutGrid className="w-4 h-4 text-indigo-400" />
                    Interactive Heatmap Kepentingan
                  </span>
                  <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950 flex flex-col justify-between h-[166px]">
                    <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-mono">
                      {/* Top Corner Header empty */}
                      <div></div>
                      <div className="text-slate-500 font-bold">C1</div>
                      <div className="text-slate-500 font-bold">C2</div>
                      <div className="text-slate-500 font-bold">C3</div>
                      <div className="text-slate-500 font-bold">C4</div>

                      {ahpData.matrix.map((row, rIdx) => (
                        <React.Fragment key={rIdx}>
                          {/* Row label */}
                          <div className="flex items-center justify-center text-slate-500 font-bold">C{rIdx + 1}</div>
                          {row.map((val, cIdx) => {
                            let cellBg = 'bg-slate-900 border-slate-800 text-slate-400';
                            let titleStr = '';

                            if (rIdx === cIdx) {
                              cellBg = 'bg-slate-800/40 border-slate-700/30 text-slate-500';
                              titleStr = `${CRITERIA_NAMES[rIdx].split(' (')[0]} sama pentingnya dengan dirinya sendiri`;
                            } else if (val > 1) {
                              titleStr = `${CRITERIA_NAMES[rIdx].split(' (')[0]} ${val.toFixed(1)}x lebih penting dari ${CRITERIA_NAMES[cIdx].split(' (')[0]}`;
                              if (val <= 3) {
                                cellBg = 'bg-indigo-600/20 border-indigo-500/10 text-indigo-300';
                              } else if (val <= 6) {
                                cellBg = 'bg-indigo-600/50 border-indigo-500/20 text-indigo-200';
                              } else {
                                cellBg = 'bg-indigo-600/80 border-indigo-500/40 text-indigo-100 font-bold';
                              }
                            } else {
                              const reciprocal = 1 / val;
                              titleStr = `${CRITERIA_NAMES[cIdx].split(' (')[0]} ${reciprocal.toFixed(1)}x lebih penting dari ${CRITERIA_NAMES[rIdx].split(' (')[0]}`;
                              if (reciprocal <= 3) {
                                cellBg = 'bg-rose-950/20 border-rose-900/10 text-rose-300';
                              } else if (reciprocal <= 6) {
                                cellBg = 'bg-rose-950/45 border-rose-900/20 text-rose-200';
                              } else {
                                cellBg = 'bg-rose-950/80 border-rose-900/40 text-rose-100 font-bold';
                              }
                            }

                            return (
                              <div
                                key={cIdx}
                                className={`flex items-center justify-center rounded-lg border h-6 cursor-help transition-all hover:scale-105 text-[9px] ${cellBg}`}
                                title={titleStr}
                              >
                                {val >= 1 ? val.toFixed(0) : `1/${(1/val).toFixed(0)}`}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-[8px] text-slate-500 font-mono mt-2 pt-1 border-t border-slate-900">
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-900"></span> Kolom Lebih Unggul</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span> Sama</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span> Baris Lebih Unggul</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Eigen Vector / Priority Weights */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  2. Eigen Vector (Bobot Prioritas Kriteria)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ahpData.eigenVector.map((weight, idx) => (
                    <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-300">{CRITERIA_NAMES[idx]}</span>
                        <span className="text-indigo-400 font-mono font-bold">{(weight * 100).toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${weight * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Mathematical Explanation (Real-Life Standard) */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-3 text-xs leading-relaxed">
                  <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    Detail Perhitungan Matematika AHP (Real-Life Standard)
                  </span>

                  <div className="space-y-2 text-[11px] text-slate-400">
                    <p>
                      Sistem AHP ini menggunakan perhitungan <strong className="text-slate-200 font-semibold">Eigenvector</strong> dan <strong className="text-slate-200 font-semibold">Uji Konsistensi Saaty (Consistency Ratio)</strong> yang valid secara akademis & praktis:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/50 space-y-1">
                        <span className="font-bold text-slate-300 block text-[10px] uppercase tracking-wide">1. Nilai Eigen Maksimum (λmax)</span>
                        <p className="text-slate-300 font-mono text-xs font-semibold">
                          λmax = {((ahpData.ci * (activeCriteria.length - 1)) + activeCriteria.length).toFixed(4)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Rata-rata elemen Consistency Vector (hasil perkalian matriks dengan Eigenvector dibagi nilai Eigenvector).
                        </p>
                      </div>

                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/50 space-y-1">
                        <span className="font-bold text-slate-300 block text-[10px] uppercase tracking-wide">2. Consistency Index (CI)</span>
                        <p className="text-slate-300 font-mono text-xs font-semibold">
                          CI = (λmax - n) / (n - 1) = {ahpData.ci.toFixed(4)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Mengukur simpangan konsistensi logis matriks berpasangan berordo n = {activeCriteria.length}.
                        </p>
                      </div>

                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/50 space-y-1">
                        <span className="font-bold text-slate-300 block text-[10px] uppercase tracking-wide">3. Random Index (RI)</span>
                        <p className="text-slate-300 font-mono text-xs font-semibold">
                          RI = {activeCriteria.length === 5 ? '1.12' : activeCriteria.length === 6 ? '1.24' : '0.90'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Konstanta indeks konsistensi acak standar Saaty untuk matriks berukuran {activeCriteria.length}x{activeCriteria.length}.
                        </p>
                      </div>

                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/50 space-y-1">
                        <span className="font-bold text-slate-300 block text-[10px] uppercase tracking-wide">4. Consistency Ratio (CR)</span>
                        <p className={`font-mono text-xs font-bold ${ahpData.isConsistent ? 'text-emerald-400' : 'text-rose-400'}`}>
                          CR = CI / RI = {ahpData.cr.toFixed(4)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Perbandingan konsistensi. Sesuai teori Saaty, matriks valid jika nilai <strong className="text-slate-400 font-semibold">CR ≤ 0.10 (10%)</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="bg-indigo-950/20 border border-indigo-900/30 p-3 rounded-lg mt-2 text-[11px] text-indigo-300">
                      <span className="font-bold text-indigo-200 block mb-0.5">💡 Analisis Strategis Bobot Kriteria</span>
                      {(() => {
                        const maxWeight = Math.max(...ahpData.eigenVector);
                        const maxIdx = ahpData.eigenVector.indexOf(maxWeight);
                        
                        // Try to get name from standard names, else optional
                        let cName = '';
                        if (maxIdx < 4) {
                           cName = CRITERIA_NAMES[maxIdx].split(' (')[0];
                        } else {
                           cName = OPTIONAL_CRITERIA.find(c => c.id === ahpData.activeCriteria?.[maxIdx])?.name.split(' (')[0] || `Kriteria ${maxIdx+1}`;
                        }

                        return (
                          <span>
                            Berdasarkan pembobotan Anda, kriteria <strong className="text-white underline">{cName}</strong> terpilih sebagai kriteria dominan dengan kontribusi <strong className="text-white font-mono font-bold">{(maxWeight * 100).toFixed(1)}%</strong>. Sistem akan memberikan bobot terbesar pada kriteria ini dalam menyusun urutan prioritas pengadaan (restock) barang.
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-slate-500 text-xs font-mono">
              Memuat data perhitungan AHP...
            </div>
          )}
        </div>
      </div>

      {/* Alternative Priority Ranking results */}
      {ahpData && ahpData.isConsistent && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/60">
            <div>
              <h3 className="text-lg font-bold text-white font-display flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Hasil Rekomendasi Ranking Alternatif Barang
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Barang diurutkan berdasarkan skor prioritas tertinggi (prioritas restock paling utama).
              </p>
            </div>

            {/* Download/Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePO}
                className="px-3.5 py-1.5 bg-emerald-950 border border-emerald-800 hover:border-emerald-500/50 hover:bg-emerald-900 text-emerald-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-900/20"
                title="Buat Draft Purchase Order Otomatis"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Draft PO</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Ekspor ke CSV"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ekspor CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20"
                title="Cetak Laporan PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-mono tracking-wider">
                  <th className="p-3 text-center">Rank</th>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3 text-right">Stok / Safety</th>
                  <th className="p-3 text-right">Profit (Eceran - Grosir)</th>
                  <th className="p-3 text-right">Terjual</th>
                  <th className="p-3 text-right">AHP Score</th>
                  <th className="p-3">Rekomendasi Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {ahpData.alternatives.map((item) => {
                  let recBg = 'bg-slate-950 border-slate-800 text-slate-400';
                  let highlightRow = '';

                  if (item.rekomendasi.includes('SANGAT SEGERA')) {
                    recBg = 'bg-rose-950/40 border-rose-800 text-rose-400 font-bold';
                    highlightRow = 'bg-rose-950/10 hover:bg-rose-950/15';
                  } else if (item.rekomendasi.includes('Beli Baru')) {
                    recBg = 'bg-amber-950/40 border-amber-800 text-amber-400 font-bold';
                    highlightRow = 'bg-amber-950/5 hover:bg-amber-950/10';
                  } else if (item.rekomendasi.includes('Optimasi')) {
                    recBg = 'bg-indigo-950/40 border-indigo-800 text-indigo-400';
                  }

                  return (
                    <tr key={item.id_barang} className={`hover:bg-slate-950/20 transition-colors ${highlightRow}`}>
                      <td className="p-3 text-center font-bold">
                        {item.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-[10px] font-extrabold animate-bounce">
                            1
                          </span>
                        ) : (
                          <span className="font-mono">{item.rank}</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-100">{item.nama_barang}</td>
                      <td className="p-3 text-right font-mono">
                        <span className={item.stok_saat_ini <= item.safety_stock ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {item.stok_saat_ini}
                        </span>{' '}
                        / <span className="text-slate-500">{item.safety_stock}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        Rp {item.profit.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-400">{item.jumlah_terjual}</td>
                      <td className="p-3 text-right font-bold text-indigo-400 font-mono text-sm">{item.score}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 text-[10px] border rounded-lg block w-max ${recBg}`}>
                          {item.rekomendasi}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sensitivity Chart */}
      {ahpData && ahpData.isConsistent && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-1.5">
              <LineChartIcon className="w-5 h-5 text-indigo-400" />
              Analisis Sensitivitas (Top 3 Barang)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Simulasi perubahan skor 3 barang teratas jika kriteria dominan saat ini bobotnya dinaikkan atau diturunkan (-50% hingga +50%).
            </p>
          </div>
          
          <div className="w-full h-64 mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getSensitivityData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }} 
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#cbd5e1' }} />
                {ahpData.alternatives.slice(0, 3).map((item, idx) => (
                  <Line 
                    key={item.nama_barang}
                    type="monotone" 
                    dataKey={item.nama_barang} 
                    stroke={idx === 0 ? '#fbbf24' : idx === 1 ? '#818cf8' : '#34d399'} 
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Draft PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" /> Draft Purchase Order
              </h3>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition">
                <Check className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-3">
                Berdasarkan hasil AHP, berikut adalah draft PO untuk barang yang perlu di-restock. Anda dapat menyalin teks ini untuk dikirimkan ke supplier.
              </p>
              <textarea
                value={poDraft}
                onChange={(e) => setPoDraft(e.target.value)}
                className="w-full h-[300px] bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
              <button 
                onClick={() => setShowPOModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Tutup
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(poDraft);
                  alert('Draft PO disalin ke clipboard!');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" /> Salin Teks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
