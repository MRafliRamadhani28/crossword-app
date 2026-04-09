'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Toast ─────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const TOAST_STYLES: Record<ToastType, { border: string; text: string; glow: string }> = {
  success: {
    border: 'rgba(57,255,20,0.25)',
    text: '#39FF14',
    glow: '0 0 20px rgba(57,255,20,0.2)',
  },
  error: {
    border: 'rgba(255,45,120,0.25)',
    text: '#FF2D78',
    glow: '0 0 20px rgba(255,45,120,0.2)',
  },
  info: {
    border: 'rgba(0,200,255,0.25)',
    text: '#00C8FF',
    glow: '0 0 20px rgba(0,200,255,0.2)',
  },
  warning: {
    border: 'rgba(255,229,0,0.3)',
    text: '#FFE500',
    glow: '0 0 20px rgba(255,229,0,0.2)',
  },
};

// ─── Dialog ────────────────────────────────────────────────────────────────

type DialogVariant = 'danger' | 'warning' | 'info';

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface AlertOptions {
  title: string;
  message: string;
  type?: ToastType;
  buttonText?: string;
}

interface DialogState {
  isOpen: boolean;
  mode: 'confirm' | 'alert';
  options: DialogOptions | AlertOptions;
  resolve: (value: boolean) => void;
}

const DIALOG_VARIANT_STYLES: Record<DialogVariant, { icon: string; color: string; btnClass: string }> = {
  danger: { icon: '🗑️', color: '#FF2D78', btnClass: 'bg-red-500 hover:bg-red-400 text-white' },
  warning: { icon: '⚠️', color: '#FFE500', btnClass: 'bg-yellow-400 hover:bg-yellow-300 text-black' },
  info: { icon: 'ℹ️', color: '#00C8FF', btnClass: 'btn-primary' },
};

const ALERT_TYPE_ICON: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

// ─── Context ───────────────────────────────────────────────────────────────

interface UIContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
  confirm: (options: DialogOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(ToastItem & { duration: number })[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  // ── Toast ────────────────────────────────────────────────────────────────

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const toast = {
    success: (msg: string, d?: number) => addToast('success', msg, d),
    error: (msg: string, d?: number) => addToast('error', msg, d),
    info: (msg: string, d?: number) => addToast('info', msg, d),
    warning: (msg: string, d?: number) => addToast('warning', msg, d),
  };

  // ── Confirm Dialog ───────────────────────────────────────────────────────

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ isOpen: true, mode: 'confirm', options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({ isOpen: true, mode: 'alert', options, resolve: (v) => resolve() });
    });
  }, []);

  const handleDialogClose = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <UIContext.Provider value={{ toast, confirm, alert }}>
      {children}

      {/* ── Toast Container ─────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const style = TOAST_STYLES[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 80, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm"
                style={{
                  background: 'rgba(10,10,10,0.85)',
                  borderColor: style.border,
                  boxShadow: style.glow,
                }}
              >
                <span className="text-base font-bold flex-shrink-0" style={{ color: style.text }}>
                  {TOAST_ICONS[t.type]}
                </span>
                <p className="text-sm text-zinc-200 flex-1 leading-snug">{t.message}</p>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs flex-shrink-0"
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Dialog Overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {dialog?.isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
              onClick={() => dialog.mode === 'alert' && handleDialogClose(true)}
            />

            {/* Dialog Card */}
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-800 p-6"
                style={{ background: 'rgba(15,15,15,0.97)', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}
              >
                {dialog.mode === 'confirm' ? (
                  <ConfirmContent
                    options={dialog.options as DialogOptions}
                    onConfirm={() => handleDialogClose(true)}
                    onCancel={() => handleDialogClose(false)}
                  />
                ) : (
                  <AlertContent
                    options={dialog.options as AlertOptions}
                    onClose={() => handleDialogClose(true)}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </UIContext.Provider>
  );
}

// ─── Confirm Dialog Content ────────────────────────────────────────────────

function ConfirmContent({
  options,
  onConfirm,
  onCancel,
}: {
  options: DialogOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const variant = options.variant ?? 'warning';
  const style = DIALOG_VARIANT_STYLES[variant];

  return (
    <>
      <div className="flex items-start gap-4 mb-5">
        <div className="text-3xl flex-shrink-0 mt-0.5">{style.icon}</div>
        <div>
          <h3 className="font-bold text-white text-base mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {options.title}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{options.message}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
        >
          {options.cancelText ?? 'Batal'}
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${style.btnClass}`}
        >
          {options.confirmText ?? 'Ya'}
        </button>
      </div>
    </>
  );
}

// ─── Alert Dialog Content ──────────────────────────────────────────────────

function AlertContent({
  options,
  onClose,
}: {
  options: AlertOptions;
  onClose: () => void;
}) {
  const type = options.type ?? 'info';
  const icon = ALERT_TYPE_ICON[type];
  const style = TOAST_STYLES[type];

  return (
    <>
      <div className="flex items-start gap-4 mb-5">
        <div className="text-3xl flex-shrink-0 mt-0.5">{icon}</div>
        <div>
          <h3 className="font-bold text-white text-base mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {options.title}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{options.message}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-lg text-sm font-bold transition-colors"
        style={{ background: style.border, color: style.text, border: `1px solid ${style.border}` }}
      >
        {options.buttonText ?? 'OK'}
      </button>
    </>
  );
}
