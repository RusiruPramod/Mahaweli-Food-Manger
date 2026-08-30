import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ message, type = "success", icon, duration = 3000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, message, type, icon, duration };

    setToasts((prev) => [...prev.slice(-3), newToast]); // Keep maximum 4 toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none flex flex-col gap-2.5">
        {toasts.map((toast) => {
          const typeStyles = {
            success: "bg-emerald-900/90 text-white border-emerald-500/30 shadow-emerald-950/20",
            info: "bg-gray-900/90 text-white border-gray-700/50 shadow-black/20",
            warn: "bg-amber-900/90 text-white border-amber-500/30 shadow-amber-950/20",
            error: "bg-rose-900/90 text-white border-rose-500/30 shadow-rose-950/20",
          }[toast.type] || "bg-gray-900/90 text-white border-gray-700 shadow-black/20";

          const defaultIcons = {
            success: "✨",
            info: "ℹ️",
            warn: "⚠️",
            error: "❌",
          };

          return (
            <div
              key={toast.id}
              className={`
                pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl
                border backdrop-blur-md shadow-lg text-xs sm:text-sm font-semibold
                animate-in slide-in-from-top-2 fade-in duration-200 transition-all
                ${typeStyles}
              `}
              role="alert"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">{toast.icon || defaultIcons[toast.type] || "✨"}</span>
                <span className="truncate">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity text-base font-bold leading-none p-1 cursor-pointer"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback safe no-op if used outside provider
    return {
      showToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
}
