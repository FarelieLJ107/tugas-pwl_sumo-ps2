import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Tv, ShoppingCart, CheckCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'checkout' | 'order' | 'success';
  title: string;
  message: string;
  timestamp: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = 'bg-slate-800 border-slate-700';
          let icon = <Bell className="text-indigo-400 w-5 h-5" />;

          if (toast.type === 'checkout') {
            bgColor = 'bg-slate-800 border-emerald-500/50 shadow-emerald-950/20 shadow-lg';
            icon = <Tv className="text-emerald-400 w-5 h-5" />;
          } else if (toast.type === 'order') {
            bgColor = 'bg-slate-800 border-amber-500/50 shadow-amber-950/20 shadow-lg';
            icon = <ShoppingCart className="text-amber-400 w-5 h-5" />;
          } else if (toast.type === 'success') {
            bgColor = 'bg-slate-800 border-indigo-500/50 shadow-indigo-950/20 shadow-lg';
            icon = <CheckCircle className="text-indigo-400 w-5 h-5" />;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`p-4 rounded-xl border ${bgColor} flex gap-3 text-slate-100 relative pointer-events-auto shadow-md`}
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0 pr-4">
                <p className="font-semibold text-sm tracking-wide font-display">{toast.title}</p>
                <p className="text-xs text-slate-300 mt-1">{toast.message}</p>
                <span className="text-[10px] text-slate-400 block mt-2 font-mono">
                  {toast.timestamp}
                </span>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
