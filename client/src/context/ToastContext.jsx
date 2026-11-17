import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', message, duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast],
  );

  const toast = useMemo(
    () => ({
      success: (message, duration) =>
        addToast({ type: 'success', message, duration }),
      error: (message, duration) =>
        addToast({ type: 'error', message, duration }),
      info: (message, duration) =>
        addToast({ type: 'info', message, duration }),
      remove: removeToast,
    }),
    [addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg bg-elevated border border-line shadow-2xl text-ink animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
              )}
              {t.type === 'error' && (
                <XCircle className="w-4 h-4 text-danger" aria-hidden="true" />
              )}
              {t.type === 'info' && (
                <Info className="w-4 h-4 text-info" aria-hidden="true" />
              )}
            </div>
            <p className="flex-1 text-xs font-medium leading-relaxed">
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="p-1 -mr-1 -mt-1 rounded text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
