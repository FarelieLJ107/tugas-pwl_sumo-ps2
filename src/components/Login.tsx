import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, User, Lock, ArrowRight, Play, Gamepad2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan login.');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: 'pegawai' | 'pemilik' | 'farelie') => {
    if (user === 'pegawai') {
      setUsername('pegawai');
      setPassword('pegawai123');
    } else if (user === 'farelie') {
      setUsername('farelie');
      setPassword('farel0857');
    } else {
      setUsername('pemilik');
      setPassword('pemilik123');
    }
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8 z-10"
      >
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 mb-4 shadow-lg shadow-indigo-950/40">
          <Gamepad2 className="w-10 h-10 animate-pulse" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-display">
          SUMO <span className="text-indigo-400">PLAYSTATION</span>
        </h1>
        <p className="text-sm text-slate-400 mt-2 font-mono tracking-widest uppercase">
          Billing & Inventory System
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-slate-900/80 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl backdrop-blur-xl z-10"
      >
        <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          Autentikasi Pengguna
        </h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs mb-4"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-900/40 disabled:bg-indigo-800 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </span>
            ) : (
              <>
                Masuk ke Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-2 text-slate-500 font-mono">Uji Coba Cepat (Preset)</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleQuickLogin('pegawai')}
            className="border border-slate-800 hover:bg-slate-800/40 text-slate-300 rounded-lg py-2 px-3 text-xs flex flex-col items-center gap-1 transition-colors group"
          >
            <span className="text-slate-400 group-hover:text-white transition-colors">Role: Pegawai</span>
            <span className="font-mono text-[10px] text-indigo-400">pegawai</span>
          </button>
          <button
            onClick={() => handleQuickLogin('farelie')}
            className="border border-slate-800 hover:bg-slate-800/40 text-slate-300 rounded-lg py-2 px-3 text-xs flex flex-col items-center gap-1 transition-colors group"
          >
            <span className="text-slate-400 group-hover:text-white transition-colors">Role: Pegawai</span>
            <span className="font-mono text-[10px] text-indigo-400">farelie</span>
          </button>
          <button
            onClick={() => handleQuickLogin('pemilik')}
            className="border border-slate-800 hover:bg-slate-800/40 text-slate-300 rounded-lg py-2 px-3 text-xs flex flex-col items-center gap-1 transition-colors group"
          >
            <span className="text-slate-400 group-hover:text-white transition-colors">Role: Pemilik</span>
            <span className="font-mono text-[10px] text-emerald-400">pemilik</span>
          </button>
        </div>
      </motion.div>

      <p className="text-xs text-slate-500 mt-8 font-mono">
        © 2026 Sumo PlayStation. All rights reserved. Secure Encrypted Sessions.
      </p>
    </div>
  );
};
