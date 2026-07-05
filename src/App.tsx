import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Package, 
  History, 
  Award, 
  LineChart, 
  LogOut, 
  User as UserIcon, 
  Gamepad2, 
  Flame, 
  Activity,
  Cpu,
  Users,
  ReceiptText,
  Menu,
  X,
  HardDrive,
  Sun,
  Moon
} from 'lucide-react';
import Swal from 'sweetalert2';
import { User, KonsolTV, Inventori } from './types';
import { Login } from './components/Login';
import { BillingCard } from './components/BillingCard';
import { InventoryPanel } from './components/InventoryPanel';
import { AHPPanel } from './components/AHPPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { LogsPanel } from './components/LogsPanel';
import { TransactionsPanel } from './components/TransactionsPanel';
import { UsersPanel } from './components/UsersPanel';
import { RentalPanel } from './components/RentalPanel';
import { NotificationToast, ToastMessage } from './components/NotificationToast';
import { FloatingAuditLogs } from './components/FloatingAuditLogs';

import { DrivePanel } from './components/DrivePanel';
import { apiClient } from './services/apiClient';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('sumops_token'));
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('billing');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Advanced Dark/Light Theme State & Effects
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sumops_theme');
    return saved === 'light' ? false : true; // Default to dark mode for game/playstation vibe
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('sumops_theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sumops_theme', 'light');
    }
  }, [darkMode]);

  // Business state
  const [tvs, setTvs] = useState<(KonsolTV & { activeBilling?: any })[]>([]);
  const [inventory, setInventory] = useState<Inventori[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Track already-alerted low stock items for this session to prevent duplicate pop-ups
  const alertedItemsRef = useRef<string[]>([]);

  // Load active session user if token exists
  const fetchMe = async (authToken: string) => {
    try {
      const data = await apiClient.auth.getMe(authToken);
      setUser(data.user);
      // Default tabs based on role
      if (data.user.role === 'pemilik') {
        setActiveTab('analytics');
      } else {
        setActiveTab('billing');
      }
    } catch (e) {
      handleLogout();
    }
  };

  useEffect(() => {
    if (token) {
      fetchMe(token);
    }
  }, [token]);

  // Fetch TVs
  const fetchTVs = async () => {
    if (!token) return;
    try {
      const data = await apiClient.tvs.getAll(token);
      setTvs(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Inventory
  const fetchInventory = async () => {
    if (!token) return;
    try {
      const data = await apiClient.inventori.getAll(token);
      setInventory(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Initial load when logged in
  useEffect(() => {
    if (token && user) {
      fetchTVs();
      fetchInventory();
    }
  }, [token, user]);

  // Low stock notification check for Pemilik
  useEffect(() => {
    if (user && user.role === 'pemilik' && inventory.length > 0) {
      const lowStockItems = inventory.filter(item => item.stok_saat_ini <= item.safety_stock);
      if (lowStockItems.length > 0) {
        // Only alert about items that haven't been alerted/shown yet in this session
        const newLowStockItems = lowStockItems.filter(item => !alertedItemsRef.current.includes(item.id_barang));
        
        if (newLowStockItems.length > 0) {
          // Update alerted items ref
          alertedItemsRef.current = [...alertedItemsRef.current, ...newLowStockItems.map(item => item.id_barang)];
          
          const listHtml = `
            <div class="text-left font-sans text-xs space-y-2 mt-3">
              <p class="text-slate-300 mb-2">Barang-barang berikut telah mencapai atau kurang dari batas <b>Safety Stock</b>:</p>
              <div class="max-h-48 overflow-y-auto border border-slate-800/80 rounded-xl bg-slate-950 p-3 divide-y divide-slate-800/60">
                ${newLowStockItems.map(item => `
                  <div class="py-2 flex justify-between items-center gap-4">
                    <span class="font-bold text-slate-100">${item.nama_barang}</span>
                    <span class="text-rose-400 font-mono font-bold bg-rose-950/40 border border-rose-900/40 px-2.5 py-0.5 rounded-lg text-[11px] shrink-0">
                      Stok: ${item.stok_saat_ini} (Safety: ${item.safety_stock})
                    </span>
                  </div>
                `).join('')}
              </div>
              <p class="text-[10px] text-slate-500 mt-2 italic text-center">Segera lakukan restock barang untuk menghindari kekosongan persediaan.</p>
            </div>
          `;

          Swal.fire({
            title: '<span class="text-amber-500 font-display font-bold flex items-center gap-1.5 justify-center text-lg">⚠️ Peringatan Stok Rendah</span>',
            html: listHtml,
            icon: 'warning',
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonText: 'Baik, Saya Mengerti',
            confirmButtonColor: '#4f46e5',
            customClass: {
              popup: 'rounded-2xl border border-slate-800 shadow-2xl'
            }
          });
        }
      }
    }
  }, [inventory, user]);

  // WebSocket setup for REAL-TIME NOTIFICATIONS
  useEffect(() => {
    if (!token || !user) return;

    let active = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let reconnectTimeoutId: any = null;
    
    const connectWS = () => {
      if (!active) return;
      console.log('Connecting to WebSocket server:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data);
          
          // Dispatch custom event for subcomponents (like RentalPanel)
          window.dispatchEvent(new CustomEvent('ws-message', { detail: payload }));
          
          if (payload.type === 'tv:status_changed') {
            fetchTVs();
          } else if (payload.type === 'tv:checkout') {
            fetchTVs();
            // Fire beautiful toast alert!
            addToast('checkout', 'Sewa TV Selesai', `${payload.data.nama_tv} selesai disewa. Tagihan Rp ${payload.data.total_bayar.toLocaleString('id-ID')} berhasil dicatat.`);
          } else if (payload.type === 'menu:order') {
            fetchTVs();
            fetchInventory();
            // Fire beautiful toast alert for orders!
            addToast('order', 'Pesanan Menu Baru', `Pesanan baru di ${payload.data.tv_name}. Total: Rp ${payload.data.total_order.toLocaleString('id-ID')}.`);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        if (!active) return;
        console.log('WebSocket disconnected. Reconnecting in 3s...');
        reconnectTimeoutId = setTimeout(() => {
          if (active && token) connectWS();
        }, 3000);
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
      };
    };

    connectWS();

    return () => {
      active = false;
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      }
    };
  }, [token, user]);

  // Toast adder
  const addToast = (type: 'info' | 'checkout' | 'order' | 'success', title: string, message: string) => {
    const newToast: ToastMessage = {
      id: 'tst-' + Math.random().toString(36).substring(2, 11),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setToasts((prev) => [...prev, newToast]);
    
    // Auto remove after 6 seconds
    setTimeout(() => {
      dismissToast(newToast.id);
    }, 6000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  };

  // Auth Action Handlers
  const handleLoginSuccess = (newToken: string, loggedUser: User) => {
    localStorage.setItem('sumops_token', newToken);
    setToken(newToken);
    setUser(loggedUser);
    if (loggedUser.role === 'pemilik') {
      setActiveTab('analytics');
    } else {
      setActiveTab('billing');
    }
    addToast('success', 'Login Berhasil', `Selamat datang kembali, ${loggedUser.nama_lengkap}!`);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await apiClient.auth.logout(token);
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('sumops_token');
    setToken(null);
    setUser(null);
    alertedItemsRef.current = [];
  };

  // Cashier Billing Handlers
  const handleStartBilling = async (id_tv: number, options: any) => {
    try {
      await apiClient.tvs.start(token!, id_tv, options);
      fetchTVs();
      addToast('success', 'Billing Dimulai', `Timer sewa TV-0${id_tv} telah aktif.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStopBilling = async (id_tv: number, paymentMethod: string) => {
    try {
      const data = await apiClient.tvs.stop(token!, id_tv, paymentMethod as any);
      fetchTVs();
      addToast('success', 'Sewa Selesai', `Pembayaran untuk TV-0${id_tv} berhasil diproses.`);
      return data;
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  const handleOrderMenu = async (id_billing: string, items: any[]) => {
    try {
      await apiClient.menu.order(token!, id_billing, items);
      fetchTVs();
      fetchInventory();
      addToast('success', 'Pesanan Disimpan', 'Menu berhasil dipesan dan mengurangi stok inventori.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSetStatus = async (id_tv: number, status: 'booking' | 'maintenance' | 'free') => {
    try {
      await apiClient.tvs.setStatus(token!, id_tv, status);
      fetchTVs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!token || !user) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute top-6 right-6 z-50">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`relative w-12 h-6 rounded-full p-0.5 transition-colors duration-300 cursor-pointer flex items-center ${
              darkMode ? 'bg-slate-950 border border-slate-800' : 'bg-indigo-100 border border-indigo-200'
            }`}
            title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
          >
            <motion.div
              layout
              className={`w-5 h-5 rounded-full flex items-center justify-center shadow-md ${
                darkMode ? 'bg-indigo-600 text-white ml-auto' : 'bg-white text-indigo-600 mr-auto'
              }`}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              {darkMode ? (
                <Moon className="w-3 h-3" />
              ) : (
                <Sun className="w-3 h-3" />
              )}
            </motion.div>
          </button>
        </div>
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row font-sans select-none text-slate-100">
      
      {/* LEFT SIDEBAR (Desktop only, block on md) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl">
              <Gamepad2 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white font-display">
                SUMO <span className="text-indigo-400">PLAYSTATION</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-mono tracking-wider uppercase">Billing & Decision</p>
            </div>
          </div>
          
          {/* Advanced Slidable Dark / Light Switch */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`relative w-11 h-6 rounded-full p-0.5 transition-colors duration-300 cursor-pointer flex items-center shrink-0 ${
              darkMode ? 'bg-slate-950 border border-slate-800' : 'bg-indigo-100 border border-indigo-200'
            }`}
            title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
          >
            <motion.div
              layout
              className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-sm ${
                darkMode ? 'bg-indigo-600 text-white ml-auto' : 'bg-white text-indigo-600 mr-auto'
              }`}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              {darkMode ? (
                <Moon className="w-2.5 h-2.5" />
              ) : (
                <Sun className="w-2.5 h-2.5" />
              )}
            </motion.div>
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {/* Owner Sections */}
          {user.role === 'pemilik' && (
            <div className="space-y-1.5 pb-4 mb-4 border-b border-slate-800/60">
              <p className="text-[9px] uppercase tracking-wider font-mono text-slate-500 font-bold px-3">Menu Pemilik</p>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <LineChart className="w-4 h-4 shrink-0 text-indigo-400" /> Laporan & Analisis
              </button>
              <button
                onClick={() => setActiveTab('ahp')}
                className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'ahp' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Award className="w-4 h-4 shrink-0 text-amber-400" /> Rekomendasi AHP
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Users className="w-4 h-4 shrink-0 text-teal-400" /> Kelola Pegawai
              </button>
              <button
                onClick={() => setActiveTab('drive')}
                className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'drive' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <HardDrive className="w-4 h-4 shrink-0 text-indigo-400" /> Google Drive
              </button>
            </div>
          )}

          {/* Cashier / Shared Sections */}
          <div className="space-y-1.5">
            {user.role === 'pemilik' && <p className="text-[9px] uppercase tracking-wider font-mono text-slate-500 font-bold px-3">Menu Kasir</p>}
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Tv className="w-4 h-4 shrink-0 text-rose-400" /> Billing PlayStation
            </button>
            <button
              onClick={() => setActiveTab('rental')}
              className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'rental' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Gamepad2 className="w-4 h-4 shrink-0 text-indigo-400" /> Rental Bawa Pulang
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <ReceiptText className="w-4 h-4 shrink-0 text-emerald-400" /> Daftar Transaksi
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Package className="w-4 h-4 shrink-0 text-yellow-400" /> Inventori & Menu
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-extrabold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <History className="w-4 h-4 shrink-0 text-slate-400" /> Log Aktivitas
            </button>
          </div>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-slate-800/80 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-2.5 bg-slate-950/45 p-2 rounded-xl border border-slate-800/55">
            <span className="p-2 bg-slate-850 border border-slate-850 rounded-lg text-slate-400 shrink-0">
              <UserIcon className="w-4 h-4 text-indigo-400" />
            </span>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-100 truncate">{user.nama_lengkap}</p>
              <span className={`text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded ${
                user.role === 'pemilik' ? 'bg-emerald-950/50 border border-emerald-900/40 text-emerald-400' : 'bg-indigo-950/50 border border-indigo-900/40 text-indigo-400'
              }`}>
                {user.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-rose-950/30 border border-slate-700/50 hover:border-rose-900/30 text-slate-400 hover:text-rose-400 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout Sesi
          </button>
        </div>
      </aside>

      {/* RIGHT CONTAINER / SUB-PANEL VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-slate-950">
        
        {/* MOBILE TOP BAR (Only visible on screens smaller than md) */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded-lg">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white font-display">
                SUMO <span className="text-indigo-400">PS</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Advanced Slidable Dark / Light Switch */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative w-11 h-6 rounded-full p-0.5 transition-colors duration-300 cursor-pointer flex items-center ${
                darkMode ? 'bg-slate-950 border border-slate-800' : 'bg-indigo-100 border border-indigo-200'
              }`}
              title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              <motion.div
                layout
                className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-sm ${
                  darkMode ? 'bg-indigo-600 text-white ml-auto' : 'bg-white text-indigo-600 mr-auto'
                }`}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                {darkMode ? (
                  <Moon className="w-2.5 h-2.5" />
                ) : (
                  <Sun className="w-2.5 h-2.5" />
                )}
              </motion.div>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-slate-850 border border-slate-750 text-slate-300 rounded-xl cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>
          </div>
        </header>

        {/* MOBILE OVERLAY NAVIGATION MENU */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="md:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col justify-between"
            >
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-indigo-400" />
                    <span className="font-extrabold text-white">SUMO PLAYSTATION</span>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                  {user.role === 'pemilik' && (
                    <div className="space-y-1.5 pb-4 mb-4 border-b border-slate-800/60">
                      <p className="text-[9px] uppercase tracking-wider font-mono text-slate-500 font-bold px-3">Pemilik</p>
                      <button
                        onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'analytics' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        <LineChart className="w-4 h-4" /> Laporan & Analisis
                      </button>
                      <button
                        onClick={() => { setActiveTab('ahp'); setMobileMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'ahp' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        <Award className="w-4 h-4" /> Rekomendasi AHP
                      </button>
                      <button
                        onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        <Users className="w-4 h-4" /> Kelola Pegawai
                      </button>
                      <button
                        onClick={() => { setActiveTab('drive'); setMobileMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'drive' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                      >
                        <HardDrive className="w-4 h-4" /> Google Drive
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {user.role === 'pemilik' && <p className="text-[9px] uppercase tracking-wider font-mono text-slate-500 font-bold px-3">Kasir</p>}
                    <button
                      onClick={() => { setActiveTab('billing'); setMobileMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'billing' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <Tv className="w-4 h-4" /> Billing PlayStation
                    </button>
                    <button
                      onClick={() => { setActiveTab('rental'); setMobileMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'rental' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <Gamepad2 className="w-4 h-4" /> Rental Bawa Pulang
                    </button>
                    <button
                      onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'transactions' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <ReceiptText className="w-4 h-4" /> Daftar Transaksi
                    </button>
                    <button
                      onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'inventory' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <Package className="w-4 h-4" /> Inventori & Menu
                    </button>
                    <button
                      onClick={() => { setActiveTab('logs'); setMobileMenuOpen(false); }}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center gap-2.5 ${activeTab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <History className="w-4 h-4" /> Log Aktivitas
                    </button>
                  </div>
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-slate-850 rounded-xl text-slate-400">
                      <UserIcon className="w-4 h-4 text-indigo-400" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white truncate">{user.nama_lengkap}</p>
                      <p className="text-[9px] uppercase font-mono text-indigo-400">{user.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                    className="w-full bg-slate-800 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout Sesi
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PRIMARY VIEWPORT MAIN CONTENT PANEL */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              {/* SCREEN 1: ANALYTICS & REPORTS (Pemilik Only) */}
              {activeTab === 'analytics' && user.role === 'pemilik' && (
                <AnalyticsPanel token={token} />
              )}

              {/* SCREEN 2: AHP INVENTORY RECOMMENDER (Pemilik Only) */}
              {activeTab === 'ahp' && user.role === 'pemilik' && (
                <AHPPanel token={token} />
              )}

              {/* SCREEN 3: EMPLOYEE MANAGEMENT CRUD (Pemilik Only) */}
              {activeTab === 'users' && user.role === 'pemilik' && (
                <UsersPanel token={token} currentUser={user} />
              )}
              {/* SCREEN 3.5: DRIVE EXPLORER (Pemilik Only) */}
              {activeTab === 'drive' && user.role === 'pemilik' && (
                <DrivePanel />
              )}

              {/* SCREEN 4: REAL-TIME TV SESSION BILLING */}
              {activeTab === 'billing' && (
                <div className="space-y-6">
                  {/* Active TV Status Summary Sub-header */}
                  <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-wrap gap-6 justify-between items-center shadow-lg">
                    <div>
                      <h2 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-1.5">
                        <Tv className="w-5 h-5 text-indigo-400 animate-pulse" />
                        Slot TV Billing PlayStation Sumo PS
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Klik salah satu tombol slot TV di bawah untuk memulai sewa, memesan menu, atau check-out pembayaran.
                      </p>
                    </div>
                    <div className="flex gap-4 text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                        {tvs.filter(t => t.status === 'kosong').length} Kosong
                      </span>
                      <span className="flex items-center gap-1.5 text-rose-400">
                        <span className="w-2 h-2 bg-rose-500 rounded-full inline-block"></span>
                        {tvs.filter(t => t.status === 'digunakan').length} Sewa Aktif
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-2 h-2 bg-amber-500 rounded-full inline-block"></span>
                        {tvs.filter(t => t.status === 'booking').length} Booking
                      </span>
                    </div>
                  </div>

                  {/* 8 Slot TV grids */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {tvs.map((tv) => (
                      <BillingCard
                        key={tv.id_tv}
                        tv={tv}
                        inventory={inventory}
                        onStartBilling={handleStartBilling}
                        onStopBilling={handleStopBilling}
                        onOrderMenu={handleOrderMenu}
                        onSetStatus={handleSetStatus}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SCREEN 4.5: SEWA BAWA PULANG KONSOL */}
              {activeTab === 'rental' && (
                <RentalPanel token={token} />
              )}

              {/* SCREEN 5: HISTORICAL TRANSACTIONS RECORD */}
              {activeTab === 'transactions' && (
                <TransactionsPanel token={token} />
              )}

              {/* SCREEN 6: INVENTORY STOCK CRUD */}
              {activeTab === 'inventory' && (
                <InventoryPanel token={token} onRefreshTrigger={fetchInventory} />
              )}

              {/* SCREEN 7: ACTIVITY AUDIT TRAIL LOG */}
              {activeTab === 'logs' && (
                <LogsPanel token={token} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Notifications Toaster */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

      {/* Floating live audit logs */}
      {token && <FloatingAuditLogs token={token} />}
    </div>
  );
}
