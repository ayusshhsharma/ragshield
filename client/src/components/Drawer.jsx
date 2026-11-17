import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle = null,
  children,
  maxWidth = 'max-w-xl',
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm transition-opacity"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          className={`w-screen ${maxWidth} bg-surface border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-200`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div className="min-w-0 pr-4">
              <h2
                id="drawer-title"
                className="text-base font-semibold text-ink truncate"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-muted font-mono mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-brand shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
