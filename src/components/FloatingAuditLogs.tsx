import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, X, ChevronDown, ChevronUp, Terminal, Activity } from 'lucide-react';
import { LogAktivitas } from '../types';

interface FloatingAuditLogsProps {
  token: string;
}

export const FloatingAuditLogs: React.FC<FloatingAuditLogsProps> = ({ token }) => {
  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchRecentLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Keep only the 5 most recent logs
        setLogs(data.slice(0, 5));
      }
    } catch (e) {
      console.error('Failed to fetch floating audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRecentLogs();
    }
  }, [token]);

  // Listen to WebSocket log notifications from window custom event
  useEffect(() => {
    const handleWSMessage = (e: Event) => {
      const payload = (e as CustomEvent).detail;
      
      // If there is a new log broadcasted by server
      if (payload.type === 'log:new' && payload.data) {
        setLogs(prev => {
          // Prevent duplicates by checking id_log
          if (prev.some(log => log.id_log === payload.data.id_log)) return prev;
          return [payload.data, ...prev].slice(0, 5);
        });
      }
    };

    window.addEventListener('ws-message', handleWSMessage);
    return () => window.removeEventListener('ws-message', handleWSMessage);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-80 font-sans print:hidden">
      <AnimatePresence>
        <motion.div
          layout
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[350px] shadow-indigo-950/20"
        >
          {/* Header */}
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className="px-4 py-3 bg-slate-950/80 border-b border-slate-850 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                Audit Log Kasir (Live)
              </span>
            </div>
            
            <button className="text-slate-400 hover:text-slate-200">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {/* Collapsible Content */}
          {isOpen && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="p-3 overflow-y-auto divide-y divide-slate-800/50 space-y-2.5 max-h-[280px]"
            >
              {logs.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-mono">
                  Menunggu aktivitas operator...
                </div>
              ) : (
                logs.map((log) => {
                  const logTime = new Date(log.waktu).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  let userBadgeColor = 'text-indigo-400';
                  if (log.id_user === 'system') userBadgeColor = 'text-slate-500';
                  else if (log.id_user === 'user-pemilik') userBadgeColor = 'text-emerald-400 font-semibold';

                  return (
                    <motion.div
                      key={log.id_log}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="pt-2.5 first:pt-0 text-[10px] space-y-1 font-mono"
                    >
                      <div className="flex justify-between items-center text-slate-500 text-[9px]">
                        <span className={userBadgeColor}>{log.nama_lengkap}</span>
                        <span>{logTime}</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed text-[10.5px]">
                        {log.aktivitas}
                      </p>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
