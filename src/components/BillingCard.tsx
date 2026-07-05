import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Clock, 
  PlusCircle, 
  StopCircle, 
  BookMarked, 
  Wrench, 
  Sparkles, 
  Check, 
  ShoppingCart, 
  ReceiptText, 
  Gamepad2, 
  AlertTriangle,
  Printer,
  Volume2,
  VolumeX
} from 'lucide-react';
import { KonsolTV, Inventori, Billing } from '../types';
import QRCode from 'qrcode';

// Helper function to calculate standard EMVCo CRC16 CCITT
function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    const code = str.charCodeAt(c);
    crc ^= (code << 8);
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Helper function to generate dynamic QRIS string
function generateQRIS(amount: number, invoiceId: string, terminalId: string = 'A01'): string {
  const pad = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  // Tag 00 - Payload Format Indicator
  let qrisStr = pad('00', '01');
  // Tag 01 - Point of Initiation Method: 12 (Dynamic)
  qrisStr += pad('01', '12');

  // Tag 26 - Merchant Account Info (Domestic QRIS Merchant Account)
  const subTag00 = pad('00', 'co.id.qris.www');
  const subTag01 = pad('01', 'ID1026483659003'); // NMID for Sumo playstation from flyer
  const subTag02 = pad('02', terminalId);
  const subTag03 = pad('03', 'UME');
  qrisStr += pad('26', `${subTag00}${subTag01}${subTag02}${subTag03}`);

  // Tag 52 - Merchant Category Code: 7994 (Video Game Arcades/Entertainment)
  qrisStr += pad('52', '7994');

  // Tag 53 - Transaction Currency: 360 (IDR)
  qrisStr += pad('53', '360');

  // Tag 54 - Transaction Amount (Dynamic Amount)
  qrisStr += pad('54', amount.toString());

  // Tag 58 - Country Code: ID
  qrisStr += pad('58', 'ID');

  // Tag 59 - Merchant Name: Sumo playstation
  qrisStr += pad('59', 'Sumo playstation');

  // Tag 60 - Merchant City: Bandung
  qrisStr += pad('60', 'Bandung');

  // Tag 61 - Postal Code: 40111
  qrisStr += pad('61', '40111');

  // Tag 62 - Additional Data Field (Invoice ID & Terminal ID)
  const addSub01 = pad('01', invoiceId.substring(0, 15));
  const addSub07 = pad('07', terminalId);
  qrisStr += pad('62', `${addSub01}${addSub07}`);

  // Tag 63 - CRC16 Checksum (Standard CCITT)
  const partial = qrisStr + '6304';
  const crc = calculateCRC16(partial);
  return `${partial}${crc}`;
}

// Text to Speech Voice Alert helper
function playVoiceAlert(text: string) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.error('Failed to trigger voice alert:', err);
  }
}

interface BillingCardProps {
  tv: KonsolTV & { activeBilling?: Billing | null };
  inventory: Inventori[];
  onStartBilling: (id_tv: number, options: { jenis_billing: 'open' | 'package'; durasi_menit: number; tarif_per_jam: number }) => Promise<void>;
  onStopBilling: (id_tv: number, paymentMethod: 'cash' | 'qris' | 'transfer') => Promise<any>;
  onOrderMenu: (id_billing: string, items: { id_barang: string; jumlah: number }[]) => Promise<void>;
  onSetStatus: (id_tv: number, status: 'booking' | 'maintenance' | 'free') => Promise<void>;
}

export const BillingCard: React.FC<BillingCardProps> = ({
  tv,
  inventory,
  onStartBilling,
  onStopBilling,
  onOrderMenu,
  onSetStatus
}) => {
  const [modalType, setModalType] = useState<'none' | 'start' | 'menu' | 'stop' | 'receipt'>('none');
  const [elapsedText, setElapsedText] = useState('00:00:00');
  const [currentCost, setCurrentCost] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [remainingText, setRemainingText] = useState('');

  // Modal State - Start Billing
  const [jenisBilling, setJenisBilling] = useState<'open' | 'package'>('open');
  const [paketJam, setPaketJam] = useState(1);
  const isTvBesar = tv.jenis_konsol.includes('Besar') || tv.id_tv <= 4;
  const [tarifPerJam, setTarifPerJam] = useState(isTvBesar ? 6000 : 5000);

  // Modal State - Order Menu
  const [cart, setCart] = useState<Record<string, number>>({}); // id_barang -> qty
  const [orderError, setOrderError] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('Semua');

  // Modal State - Stop Billing
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [qrisQrUrl, setQrisQrUrl] = useState<string>('');
  const [qrisStringVal, setQrisStringVal] = useState<string>('');

  // Voice Alerts & Cash Return Calculator states
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(() => localStorage.getItem('sumops_voice_alerts') !== 'false');
  const alertedFiveMinRef = useRef<Record<string, boolean>>({});
  const alertedFinishedRef = useRef<Record<string, boolean>>({});
  const [cashReceivedStr, setCashReceivedStr] = useState<string>('');

  const printReceipt = (data: any) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const tanggal = new Date(data.transaksi.tanggal_transaksi).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const itemsHtml = data.menu_items && data.menu_items.length > 0
      ? data.menu_items.map((item: any) => `
        <tr>
          <td style="padding: 4px 0;">${item.nama_barang} x${item.jumlah}</td>
          <td style="text-align: right; padding: 4px 0;">Rp ${item.subtotal.toLocaleString('id-ID')}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="2" style="text-align: center; color: #888; padding: 8px 0; font-style: italic;">Tidak ada pesanan menu</td></tr>';

    const totalSewa = data.billing.total_sewa || 0;
    const totalMenu = data.billing.total_menu || 0;
    const totalBayar = data.billing.total_bayar || 0;
    const durasiMenit = data.billing.durasi_menit || 0;
    const jam = Math.floor(durasiMenit / 60);
    const menit = durasiMenit % 60;
    const durasiStr = `${jam > 0 ? `${jam} jam ` : ''}${menit} menit`;

    const html = `
      <html>
        <head>
          <title>Struk Pembayaran Sumo PS</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 10px;
              width: 72mm;
              max-width: 100%;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .header {
              margin-bottom: 10px;
            }
            .header h1 {
              font-size: 15px;
              margin: 0 0 3px 0;
              text-transform: uppercase;
            }
            .header p {
              margin: 1px 0;
              font-size: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            .totals {
              margin-top: 8px;
            }
            .totals td {
              padding: 1px 0;
            }
            .footer {
              margin-top: 15px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header text-center">
            <h1>SUMO PS</h1>
            <p>Jl. Sumo Raya No. 45, Bandung</p>
            <p>Telp: 0812-3456-7890</p>
          </div>
          
          <div class="divider"></div>
          
          <table>
            <tr>
              <td>No. Trans:</td>
              <td class="text-right">${data.transaksi.id_transaksi}</td>
            </tr>
            <tr>
              <td>Tanggal:</td>
              <td class="text-right">${tanggal}</td>
            </tr>
            <tr>
              <td>TV/Konsol:</td>
              <td class="text-right">${data.tv.nama_tv} / ${data.tv.jenis_konsol}</td>
            </tr>
            <tr>
              <td>Kasir:</td>
              <td class="text-right">${data.kasir || 'Kasir'}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <div class="bold">RINCIAN SEWA:</div>
          <table>
            <tr>
              <td style="padding: 2px 0;">Sewa PS (${durasiStr})<br><small>@ Rp ${data.billing.tarif_per_jam.toLocaleString('id-ID')}/jam</small></td>
              <td class="text-right" style="vertical-align: bottom; padding: 2px 0;">Rp ${totalSewa.toLocaleString('id-ID')}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <div class="bold">PESANAN MENU:</div>
          <table>
            ${itemsHtml}
          </table>
          
          <div class="divider"></div>
          
          <table class="totals">
            <tr>
              <td>Total Sewa:</td>
              <td class="text-right">Rp ${totalSewa.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Total Menu:</td>
              <td class="text-right">Rp ${totalMenu.toLocaleString('id-ID')}</td>
            </tr>
            <tr class="bold" style="font-size: 12px;">
              <td>GRAND TOTAL:</td>
              <td class="text-right">Rp ${totalBayar.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Metode Bayar:</td>
              <td class="text-right" style="text-transform: uppercase;">${data.transaksi.metode_pembayaran}</td>
            </tr>
            ${data.transaksi.metode_pembayaran === 'cash' && data.cash_received > 0 ? `
            <tr>
              <td>Uang Diterima:</td>
              <td class="text-right">Rp ${data.cash_received.toLocaleString('id-ID')}</td>
            </tr>
            <tr class="bold">
              <td>Kembalian:</td>
              <td class="text-right">Rp ${data.cash_change.toLocaleString('id-ID')}</td>
            </tr>
            ` : ''}
          </table>
          
          <div class="divider"></div>
          
          <div class="footer text-center">
            <p class="bold">TERIMA KASIH ATAS KUNJUNGANNYA</p>
            <p>SUMO PS - Sahabat Gamers Anda!</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.parent.postMessage('print_complete', '*');
              }, 1000);
            }
          </script>
        </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'print_complete') {
        try {
          document.body.removeChild(iframe);
        } catch (e) {}
        window.removeEventListener('message', handleMessage);
      }
    };
    window.addEventListener('message', handleMessage);
  };

  // Real-time Timer update
  useEffect(() => {
    if (tv.status !== 'digunakan' || !tv.activeBilling) {
      setElapsedText('00:00:00');
      setCurrentCost(0);
      setProgressPercent(0);
      setRemainingText('');
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(tv.activeBilling!.waktu_mulai).getTime();
      const now = Date.now();
      const diffMs = Math.max(0, now - startTime);
      
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      const displayTime = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
      ].join(':');

      setElapsedText(displayTime);

      // Estimate real-time sewa cost
      let activeMinutes = Math.floor(diffMs / 60000);
      if (activeMinutes < 1) activeMinutes = 1;

      // Sync voice alerts enabled to ref to avoid stale closure
      const voiceAlertsEnabledRef = { current: voiceAlertsEnabled };

      let calculatedCost = 0;
      if (tv.activeBilling!.durasi_menit > 0) {
        // Pre-defined package duration
        calculatedCost = Math.ceil((tv.activeBilling!.durasi_menit / 60) * tv.activeBilling!.tarif_per_jam);
        
        // Progress Calculation
        const totalDurationMs = tv.activeBilling!.durasi_menit * 60000;
        let percent = (diffMs / totalDurationMs) * 100;
        if (percent > 100) percent = 100;
        setProgressPercent(percent);

        const remainingMs = Math.max(0, totalDurationMs - diffMs);
        const remH = Math.floor(remainingMs / 3600000);
        const remM = Math.floor((remainingMs % 3600000) / 60000);
        const remS = Math.floor((remainingMs % 60000) / 1000);
        setRemainingText(`${remH.toString().padStart(2, '0')}:${remM.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`);

        // Audio Session Alert triggers
        if (voiceAlertsEnabledRef.current) {
          const billingId = tv.activeBilling!.id_billing;
          // Alert at 5 minutes remaining (300,000 ms)
          if (remainingMs <= 300000 && remainingMs > 10000 && !alertedFiveMinRef.current[billingId]) {
            alertedFiveMinRef.current[billingId] = true;
            playVoiceAlert(`${tv.nama_tv} sisa waktu lima menit lagi.`);
          }
          // Alert when time is up
          if (remainingMs <= 0 && !alertedFinishedRef.current[billingId]) {
            alertedFinishedRef.current[billingId] = true;
            playVoiceAlert(`Waktu sewa paket ${tv.nama_tv} telah habis.`);
          }
        }
      } else {
        // Dynamic play
        calculatedCost = Math.ceil((activeMinutes / 60) * tv.activeBilling!.tarif_per_jam);
        setProgressPercent(100); // Or maybe 0, or just indeterminate
        setRemainingText('');
      }

      setCurrentCost(calculatedCost);
    }, 1000);

    return () => clearInterval(interval);
  }, [tv.status, tv.activeBilling, voiceAlertsEnabled]);

  // Generate dynamic QRIS QR code
  useEffect(() => {
    if (modalType === 'stop' && paymentMethod === 'qris' && tv.activeBilling) {
      const grandTotal = currentCost + (tv.activeBilling.total_menu || 0);
      const invoiceId = tv.activeBilling.id_billing.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
      const qrisStr = generateQRIS(grandTotal, invoiceId, 'A01');
      setQrisStringVal(qrisStr);
      
      QRCode.toDataURL(qrisStr, {
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      .then(url => {
        setQrisQrUrl(url);
      })
      .catch(err => {
        console.error('Failed to generate QR Code:', err);
      });
    } else {
      setQrisQrUrl('');
      setQrisStringVal('');
    }
  }, [modalType, paymentMethod, tv.activeBilling, currentCost]);

  // Handle Order submit
  const handleOrderSubmit = async () => {
    if (!tv.activeBilling) return;
    const items = Object.entries(cart)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([id_barang, qty]) => ({ id_barang, jumlah: qty }));

    if (items.length === 0) {
      setOrderError('Silakan pilih minimal 1 item.');
      return;
    }

    try {
      await onOrderMenu(tv.activeBilling.id_billing, items);
      setCart({});
      setOrderError('');
      setModalType('none');
    } catch (err: any) {
      setOrderError(err.message || 'Gagal memesan.');
    }
  };

  // Status visual configurations
  let statusBadgeColor = 'bg-slate-800 border-slate-700 text-slate-400';
  let cardGlow = '';
  
  if (tv.status === 'digunakan') {
    statusBadgeColor = 'bg-rose-950/40 border-rose-800 text-rose-400 font-bold';
    cardGlow = 'ring-1 ring-rose-800/40 shadow-lg shadow-rose-950/20';
  } else if (tv.status === 'booking') {
    statusBadgeColor = 'bg-amber-950/40 border-amber-800 text-amber-400 font-bold';
    cardGlow = 'ring-1 ring-amber-800/40 shadow-lg shadow-amber-950/10';
  } else if (tv.status === 'maintenance') {
    statusBadgeColor = 'bg-slate-950 border-slate-800 text-slate-500 line-through';
  } else if (tv.status === 'kosong') {
    statusBadgeColor = 'bg-emerald-950/40 border-emerald-800 text-emerald-400 font-bold animate-pulse';
    cardGlow = 'ring-1 ring-emerald-800/20';
  }

  return (
    <>
      {/* 1. Main TV Slot Grid Card */}
      <motion.div
        layout
        className={`bg-slate-900 border border-slate-800/60 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${cardGlow}`}
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-xs font-mono text-slate-500 block uppercase tracking-wider">
                {tv.jenis_konsol}
              </span>
              <h3 className="text-xl font-bold text-white font-display tracking-tight mt-0.5">
                {tv.nama_tv}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {tv.status === 'digunakan' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newVal = !voiceAlertsEnabled;
                    setVoiceAlertsEnabled(newVal);
                    localStorage.setItem('sumops_voice_alerts', String(newVal));
                    if (newVal) {
                      playVoiceAlert(`Suara TV ${tv.id_tv} aktif`);
                    }
                  }}
                  className={`p-1.5 rounded-lg border transition-colors ${voiceAlertsEnabled ? 'bg-indigo-950/40 border-indigo-900/40 text-indigo-400 hover:bg-indigo-950 hover:text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-400'}`}
                  title={voiceAlertsEnabled ? "Matikan suara peringatan" : "Aktifkan suara peringatan"}
                >
                  {voiceAlertsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              )}
              <span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 rounded-full font-mono ${statusBadgeColor}`}>
                {tv.status === 'free' ? 'kosong' : tv.status}
              </span>
            </div>
          </div>

          {/* Body status visualization */}
          {tv.status === 'digunakan' && tv.activeBilling ? (
            <div className="space-y-3 my-4 bg-slate-950/50 border border-slate-800/50 p-3.5 rounded-xl">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-rose-500" /> Timer</span>
                <span className="font-mono text-rose-400 font-bold tracking-wider text-sm">{elapsedText}</span>
              </div>
              
              {/* Progress Bar for Package Billing */}
              {tv.activeBilling.durasi_menit > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Terpakai</span>
                    <span className={progressPercent > 90 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-400'}>
                      Sisa: {remainingText}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className={`h-full ${progressPercent > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ ease: "linear", duration: 1 }}
                    />
                  </div>
                </div>
              )}
              {tv.activeBilling.durasi_menit === 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Open Play</span>
                    <span className="text-emerald-500 font-bold animate-pulse">
                      Sedang Bermain
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden relative">
                    <motion.div
                      className="absolute top-0 bottom-0 bg-emerald-500/50 w-1/3 rounded-full"
                      animate={{ 
                        left: ['-30%', '100%']
                      }}
                      transition={{ 
                        repeat: Infinity,
                        duration: 1.5, 
                        ease: "easeInOut" 
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800/60 mt-1">
                <span>Billing</span>
                <span className="font-mono text-slate-200">
                  {tv.activeBilling.durasi_menit > 0 ? `Paket ${tv.activeBilling.durasi_menit / 60} Jam` : 'Open Play'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Sewa PS</span>
                <span className="font-mono font-semibold text-slate-100">
                  Rp {currentCost.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-800/60 pt-2">
                <span>Pilihan Menu</span>
                <span className="font-mono text-amber-400 font-medium">
                  + Rp {(tv.activeBilling.total_menu || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2">
                <span className="font-semibold text-slate-300">Estimasi Total</span>
                <span className="font-mono text-emerald-400 font-extrabold text-sm">
                  Rp {(currentCost + (tv.activeBilling.total_menu || 0)).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ) : tv.status === 'booking' ? (
            <div className="my-5 flex flex-col items-center justify-center py-4 bg-amber-950/10 border border-amber-900/30 rounded-xl text-amber-500 text-xs text-center">
              <BookMarked className="w-6 h-6 mb-1.5 animate-bounce" />
              Slot dipesan pelanggan
            </div>
          ) : tv.status === 'maintenance' ? (
            <div className="my-5 flex flex-col items-center justify-center py-4 bg-slate-950 border border-slate-800/50 rounded-xl text-slate-500 text-xs text-center line-through">
              <Wrench className="w-6 h-6 mb-1.5" />
              Pemeliharaan Konsol
            </div>
          ) : (
            <div className="my-5 flex flex-col items-center justify-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs text-center">
              <Gamepad2 className="w-8 h-8 mb-2 text-slate-700" />
              Slot Kosong / Tersedia
            </div>
          )}
        </div>

        {/* Action button panel */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tv.status === 'kosong' || tv.status === 'booking' ? (
            <>
              <button
                onClick={() => setModalType('start')}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2 text-xs flex items-center justify-center gap-1 shadow-lg shadow-indigo-950/50 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Mulai
              </button>
              {tv.status === 'kosong' && (
                <>
                  <button
                    onClick={() => onSetStatus(tv.id_tv, 'booking')}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg p-2 transition-colors"
                    title="Set Booking"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSetStatus(tv.id_tv, 'maintenance')}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg p-2 transition-colors"
                    title="Set Maintenance"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {tv.status === 'booking' && (
                <button
                  onClick={() => onSetStatus(tv.id_tv, 'free')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs transition-colors"
                >
                  Batal Booking
                </button>
              )}
            </>
          ) : tv.status === 'digunakan' ? (
            <>
              <button
                onClick={() => {
                  setCart({});
                  setModalType('menu');
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg py-2 text-xs flex items-center justify-center gap-1 shadow-lg shadow-amber-950/50 transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Pesan Menu
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('cash');
                  setModalType('stop');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg py-2 text-xs flex items-center justify-center gap-1 shadow-lg shadow-emerald-950/50 transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Selesai / Bayar
              </button>
            </>
          ) : (
            // Maintenance mode
            <button
              onClick={() => onSetStatus(tv.id_tv, 'free')}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-lg py-2 text-xs transition-colors"
            >
              Selesai Maintenance (Tersedia)
            </button>
          )}
        </div>
      </motion.div>

      {/* 2. Modals Backdrop Overlay */}
      <AnimatePresence>
        {modalType !== 'none' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          >
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* MODAL 1: START BILLING */}
              {modalType === 'start' && (
                <div>
                  <h3 className="text-xl font-bold font-display text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Mulai Billing {tv.nama_tv}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Jenis Billing</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setJenisBilling('open')}
                          className={`p-3 rounded-xl border text-sm font-semibold transition-all ${jenisBilling === 'open' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          Open Play (Bebas)
                        </button>
                        <button
                          onClick={() => setJenisBilling('package')}
                          className={`p-3 rounded-xl border text-sm font-semibold transition-all ${jenisBilling === 'package' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                        >
                          Paket Waktu
                        </button>
                      </div>
                    </div>

                    {jenisBilling === 'package' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 pt-2"
                      >
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Pilih Durasi Paket</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3, 4, 5].map((hour) => (
                            <button
                              key={hour}
                              onClick={() => setPaketJam(hour)}
                              className={`p-2 rounded-lg border text-xs font-semibold transition-colors ${paketJam === hour ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'}`}
                            >
                              {hour} Jam
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tarif Sewa Per Jam (IDR)</label>
                      <select
                        value={tarifPerJam}
                        onChange={(e) => setTarifPerJam(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
                      >
                        {isTvBesar ? (
                          <>
                            <option value={6000}>Rp 6.000 / Jam (PS 4 - TV Besar)</option>
                            <option value={5000}>Rp 5.000 / Jam (PS 3 - TV Besar)</option>
                          </>
                        ) : (
                          <>
                            <option value={5000}>Rp 5.000 / Jam (PS 4 - TV Kecil)</option>
                            <option value={4000}>Rp 4.000 / Jam (PS 3 - TV Kecil)</option>
                            <option value={5000}>Rp 5.000 / Jam (PS 4 - Promo Anak-Anak)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Estimasi Sewa */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-400">
                      <div className="flex justify-between">
                        <span>Konsol:</span>
                        <span className="text-slate-200 font-semibold">{tv.jenis_konsol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tarif:</span>
                        <span className="text-slate-200 font-semibold">Rp {tarifPerJam.toLocaleString('id-ID')} / jam</span>
                      </div>
                      {jenisBilling === 'package' && (
                        <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 font-semibold text-indigo-400">
                          <span>Total Biaya Paket:</span>
                          <span>Rp {(paketJam * tarifPerJam).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setModalType('none')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={async () => {
                        const mins = jenisBilling === 'package' ? paketJam * 60 : 0;
                        await onStartBilling(tv.id_tv, { jenis_billing: jenisBilling, durasi_menit: mins, tarif_per_jam: tarifPerJam });
                        setModalType('none');
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Mulai Sekarang
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 2: ORDER MENU */}
              {modalType === 'menu' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <h3 className="text-xl font-bold font-display text-white mb-2 flex items-center gap-2 flex-shrink-0">
                    <ShoppingCart className="w-5 h-5 text-amber-500" />
                    Pesan Menu - {tv.nama_tv}
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 flex-shrink-0">
                    Sewa Aktif: {tv.activeBilling?.id_billing.substring(0, 8)}
                  </p>

                  {orderError && (
                    <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs mb-3 flex-shrink-0">
                      {orderError}
                    </div>
                  )}

                  {/* Category Filter Tabs */}
                  <div className="flex gap-1.5 mb-3 flex-shrink-0">
                    {['Semua', 'Makanan', 'Minuman', 'Camilan'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedMenuCategory(cat)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border font-mono transition-all cursor-pointer ${
                          selectedMenuCategory === cat
                            ? 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-950/40'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Menu Items lists with scroll */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 max-h-[40vh]">
                    {(() => {
                      const filteredInventory = selectedMenuCategory === 'Semua'
                        ? inventory
                        : inventory.filter(item => item.kategori === selectedMenuCategory);

                      return filteredInventory.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">Data barang kategori ini kosong.</p>
                      ) : (
                        filteredInventory.map((item) => {
                          const qty = cart[item.id_barang] || 0;
                          return (
                            <div
                              key={item.id_barang}
                              className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center hover:border-slate-700 transition-colors"
                            >
                              <div>
                                <p className="text-xs font-semibold text-white">{item.nama_barang}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Rp {item.harga_eceran.toLocaleString('id-ID')} • Stok: {item.stok_saat_ini}
                                </p>
                                {item.stok_saat_ini <= item.safety_stock && (
                                  <span className="text-[9px] bg-rose-950/30 text-rose-400 border border-rose-900/30 px-1.5 py-0.5 rounded block mt-1 w-max">
                                    Stok Tipis
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (qty > 0) setCart({ ...cart, [item.id_barang]: qty - 1 });
                                  }}
                                  disabled={qty === 0}
                                  className="w-6 h-6 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 text-sm font-bold flex items-center justify-center transition-colors"
                                >
                                  -
                                </button>
                                <span className="font-mono text-sm font-semibold text-white w-5 text-center">{qty}</span>
                                <button
                                  onClick={() => {
                                    if (qty < item.stok_saat_ini) setCart({ ...cart, [item.id_barang]: qty + 1 });
                                  }}
                                  disabled={qty >= item.stok_saat_ini}
                                  className="w-6 h-6 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 text-sm font-bold flex items-center justify-center transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })
                      );
                    })()}
                  </div>

                  {/* Summary / Total order */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mt-4 flex-shrink-0 text-xs">
                    <div className="flex justify-between font-semibold text-white">
                      <span>Total Pesanan Menu:</span>
                      <span className="text-amber-400 font-mono text-sm">
                        Rp {Object.entries(cart)
                          .reduce((sum, [id, qty]) => {
                            const item = inventory.find(i => i.id_barang === id);
                            return sum + ((qty as number) * (item?.harga_eceran || 0));
                          }, 0)
                          .toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4 flex-shrink-0">
                    <button
                      onClick={() => setModalType('none')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleOrderSubmit}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-1 shadow-lg shadow-amber-950/40"
                    >
                      <Check className="w-4 h-4" /> Simpan Pesanan
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 3: STOP / CHECKOUT BILLING */}
              {modalType === 'stop' && (
                <div>
                  <h3 className="text-xl font-bold font-display text-white mb-4 flex items-center gap-2">
                    <ReceiptText className="w-5 h-5 text-emerald-400" />
                    Selesai & Bayar {tv.nama_tv}
                  </h3>

                  <div className="space-y-4">
                    {/* Invoice items */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Biaya Sewa PS ({elapsedText}):</span>
                        <span className="font-mono text-slate-200">Rp {currentCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                        <span>Biaya Menu Tambahan:</span>
                        <span className="font-mono text-slate-200">Rp {(tv.activeBilling?.total_menu || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-emerald-400 pt-1">
                        <span>Grand Total Bayar:</span>
                        <span className="font-mono text-base">
                          Rp {(currentCost + (tv.activeBilling?.total_menu || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Payment Method selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Metode Pembayaran</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['cash', 'qris', 'transfer'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(method);
                              setCashReceivedStr('');
                            }}
                            className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors uppercase font-mono ${paymentMethod === method ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950/40' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    {paymentMethod === 'cash' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Kalkulator Kembalian Uang
                          </label>
                          <button
                            type="button"
                            onClick={() => setCashReceivedStr(String(currentCost + (tv.activeBilling?.total_menu || 0)))}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase font-mono bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded transition-colors"
                          >
                            Uang Pas
                          </button>
                        </div>

                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-mono text-xs pointer-events-none">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Masukkan jumlah uang diterima..."
                            value={cashReceivedStr}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setCashReceivedStr(val);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>

                        {/* Quick cash helpers */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[10000, 20000, 50000, 100000].map((amount) => {
                            const grandTotal = currentCost + (tv.activeBilling?.total_menu || 0);
                            if (amount < grandTotal) return null;
                            return (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => setCashReceivedStr(String(amount))}
                                className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md px-2 py-1 font-mono font-bold transition-all"
                              >
                                {amount.toLocaleString('id-ID')}
                              </button>
                            );
                          })}
                        </div>

                        {/* Change Display */}
                        {cashReceivedStr && (
                          <div className="pt-2 border-t border-slate-900/80 flex justify-between items-center text-xs font-mono font-bold">
                            <span className="text-slate-400">Kembalian:</span>
                            {(() => {
                              const grandTotal = currentCost + (tv.activeBilling?.total_menu || 0);
                              const cash = parseInt(cashReceivedStr) || 0;
                              const change = cash - grandTotal;
                              if (change < 0) {
                                return <span className="text-rose-400">Kurang: Rp {Math.abs(change).toLocaleString('id-ID')}</span>;
                              }
                              return <span className="text-emerald-400 text-sm">Rp {change.toLocaleString('id-ID')}</span>;
                            })()}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {paymentMethod === 'qris' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-md text-slate-950 flex flex-col items-center justify-center relative overflow-hidden"
                      >
                        {/* QRIS Top Logo Banner */}
                        <div className="w-full flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-[#0f172a] text-white px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider font-sans leading-none">QRIS</span>
                            <div className="text-[7px] leading-tight text-slate-600 font-bold uppercase">
                              QR Code Standard<br/>Pembayaran Nasional
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-red-600 font-bold text-xs tracking-tighter leading-none font-sans">GPN</span>
                            <span className="text-[6px] text-slate-400 uppercase leading-none mt-0.5 font-bold">Nasional</span>
                          </div>
                        </div>

                        {/* Merchant Details */}
                        <div className="text-center mb-3">
                          <h4 className="text-xs font-extrabold tracking-tight text-slate-950 uppercase">Sumo playstation</h4>
                          <p className="text-[9px] font-mono text-slate-500 mt-0.5">NMID : ID1026483659003</p>
                          <p className="text-[8px] font-mono text-slate-400 uppercase mt-0.5">Terminal: A01</p>
                        </div>

                        {/* QR Code Canvas/Image */}
                        <div className="bg-white border-2 border-slate-100 p-2 rounded-lg flex items-center justify-center shadow-sm relative">
                          {qrisQrUrl ? (
                            <img src={qrisQrUrl} alt="QRIS Dynamic QR Code" className="w-44 h-44 object-contain" />
                          ) : (
                            <div className="w-44 h-44 flex items-center justify-center bg-slate-50 text-slate-400 text-[10px] font-mono animate-pulse">
                              Generating QRIS...
                            </div>
                          )}
                        </div>

                        {/* Footer details */}
                        <div className="text-center mt-3 w-full">
                          <p className="text-[9px] font-bold text-slate-800 tracking-wider">SATU QRIS UNTUK SEMUA</p>
                          <p className="text-[7px] text-slate-500 font-medium font-sans">Cek aplikasi penyelenggara di: www.aspi-qris.id</p>
                        </div>

                        {/* Payment details */}
                        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2 w-full flex justify-between items-center text-xs">
                          <div className="text-left">
                            <span className="text-[9px] text-slate-500 uppercase block font-mono">Total Tagihan</span>
                            <span className="font-bold text-slate-900 font-mono text-sm">
                              Rp {(currentCost + (tv.activeBilling?.total_menu || 0)).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-1 rounded-full uppercase animate-pulse font-sans">
                            Dynamic QR
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {paymentMethod === 'qris' && (
                      <div className="text-center text-[10px] text-slate-400 bg-slate-900 border border-slate-800 p-2 rounded-lg leading-relaxed">
                        Tunjukkan QRIS di atas kepada pelanggan. Setelah di-scan dan dibayar, klik tombol <span className="text-emerald-400 font-semibold">Proses Pembayaran</span> untuk mengonfirmasi dan mencetak struk.
                      </div>
                    )}

                    <div className="flex items-center gap-2 p-3 bg-amber-950/20 border border-amber-900/30 text-amber-500 rounded-lg text-[11px]">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>Hentikan timer, simpan data ke laporan transaksi, dan kosongkan slot TV.</span>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setModalType('none');
                        setCashReceivedStr('');
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs transition-colors"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const data = await onStopBilling(tv.id_tv, paymentMethod);
                          if (data && data.success) {
                            const cashVal = parseInt(cashReceivedStr) || 0;
                            data.cash_received = cashVal;
                            data.cash_change = Math.max(0, cashVal - (data.billing.total_bayar || 0));

                            setReceiptData(data);
                            setModalType('receipt');
                            setCashReceivedStr('');
                            setTimeout(() => {
                              printReceipt(data);
                            }, 300);
                          } else {
                            setModalType('none');
                          }
                        } catch (err) {
                          console.error('Failed to stop billing:', err);
                        }
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-1 shadow-lg shadow-emerald-950/40"
                    >
                      <Check className="w-4 h-4" /> Proses Pembayaran
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 4: PRINT RECEIPT SUMMARY */}
              {modalType === 'receipt' && receiptData && (
                <div className="space-y-4 text-left">
                  <div className="text-center pb-2">
                    <div className="mx-auto w-12 h-12 bg-emerald-950/40 text-emerald-400 rounded-full flex items-center justify-center mb-2 animate-bounce">
                      <Printer className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold font-display text-white">Pembayaran Sukses</h3>
                    <p className="text-xs text-slate-400">Struk sedang dicetak secara otomatis...</p>
                  </div>

                  {/* Thermal Receipt Preview */}
                  <div className="bg-white text-slate-900 p-4 rounded-lg shadow-inner font-mono text-[11px] max-h-72 overflow-y-auto border border-slate-200">
                    <div className="text-center font-bold text-sm uppercase">SUMO PS</div>
                    <div className="text-center text-[10px] text-slate-600 font-sans">Jl. Sumo Raya No. 45, Bandung</div>
                    <div className="text-center text-[10px] text-slate-600 font-sans pb-2 border-b border-dashed border-slate-300">Telp: 0812-3456-7890</div>
                    
                    <div className="space-y-1 pt-2 pb-2 text-[10px] text-slate-700">
                      <div className="flex justify-between">
                        <span>No Trans:</span>
                        <span>{receiptData.transaksi?.id_transaksi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tanggal:</span>
                        <span>{new Date(receiptData.transaksi?.tanggal_transaksi).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TV/Konsol:</span>
                        <span>{receiptData.tv?.nama_tv} ({receiptData.tv?.jenis_konsol})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span>{receiptData.kasir || 'Kasir'}</span>
                      </div>
                    </div>
                    <div className="border-b border-dashed border-slate-300"></div>

                    <div className="pt-2 pb-1 font-bold text-[11px]">RINCIAN SEWA:</div>
                    <div className="flex justify-between text-[10px]">
                      <span>Sewa PS ({Math.floor(receiptData.billing?.durasi_menit / 60)}j {receiptData.billing?.durasi_menit % 60}m)</span>
                      <span>Rp {receiptData.billing?.total_sewa?.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-[9px] text-slate-500 italic">
                      @ Rp {receiptData.billing?.tarif_per_jam?.toLocaleString('id-ID')}/jam
                    </div>

                    {receiptData.menu_items && receiptData.menu_items.length > 0 && (
                      <>
                        <div className="border-b border-dashed border-slate-300 my-2"></div>
                        <div className="pt-1 pb-1 font-bold text-[11px]">PESANAN MENU:</div>
                        <div className="space-y-1 text-[10px]">
                          {receiptData.menu_items.map((item: any) => (
                            <div key={item.id_detail} className="flex justify-between">
                              <span>{item.nama_barang} x{item.jumlah}</span>
                              <span>Rp {item.subtotal?.toLocaleString('id-ID')}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="border-b border-dashed border-slate-300 my-2"></div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Total Sewa:</span>
                        <span>Rp {receiptData.billing?.total_sewa?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Total Menu:</span>
                        <span>Rp {receiptData.billing?.total_menu?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-slate-300">
                        <span>GRAND TOTAL:</span>
                        <span>Rp {receiptData.billing?.total_bayar?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>Metode Bayar:</span>
                        <span className="uppercase font-bold text-emerald-700">{receiptData.transaksi?.metode_pembayaran}</span>
                      </div>
                      {receiptData.transaksi?.metode_pembayaran === 'cash' && receiptData.cash_received > 0 && (
                        <>
                          <div className="flex justify-between font-semibold text-slate-800">
                            <span>Uang Diterima:</span>
                            <span>Rp {receiptData.cash_received.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-900 border-t border-dashed border-slate-200 pt-0.5 mt-0.5">
                            <span>Kembalian:</span>
                            <span>Rp {receiptData.cash_change.toLocaleString('id-ID')}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-b border-dashed border-slate-300 my-2"></div>
                    <div className="text-center text-[10px] font-bold mt-2 font-sans text-slate-800">TERIMA KASIH ATAS KUNJUNGANNYA</div>
                    <div className="text-center text-[9px] text-slate-600 font-sans">SUMO PS - Sahabat Gamers Anda!</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setModalType('none')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg py-2.5 text-xs transition-colors"
                    >
                      Tutup
                    </button>
                    <button
                      onClick={() => printReceipt(receiptData)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg py-2.5 text-xs transition-colors flex items-center justify-center gap-1 shadow-lg shadow-emerald-950/40"
                    >
                      <Printer className="w-4 h-4" /> Cetak Ulang
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
