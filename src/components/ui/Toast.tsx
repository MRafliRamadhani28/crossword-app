'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onClose: (id: string) => void;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastProps[];
  removeToast: (id: string) => void;
}

const icons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const colors: Record<ToastType, string> = {
  success: 'bg-green-500/10 border-green-500/20 text-green-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
};

const glowColors: Record<ToastType, string> = {
  success: '0 0 20px rgba(57,255,20,0.3)',
  error: '0 0 20px rgba(255,45,120,0.3)',
  info: '0 0 20px rgba(59,130,246,0.3)',
  warning: '0 0 20px rgba(255,229,0,0.3)',
};

export function Toast({ id, type, message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm ${colors[type]}`}
      style={{ boxShadow: glowColors[type] }}
    >
      <span className="text-lg font-bold">{icons[type]}</span>
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-xs opacity-50 hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook for easy toast usage
export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = (type: ToastType, message: string, duration?: number) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, onClose: removeToast, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message: string, duration?: number) => addToast('success', message, duration);
  const error = (message: string, duration?: number) => addToast('error', message, duration);
  const info = (message: string, duration?: number) => addToast('info', message, duration);
  const warning = (message: string, duration?: number) => addToast('warning', message, duration);

  return { toasts, removeToast, success, error, info, warning };
}
