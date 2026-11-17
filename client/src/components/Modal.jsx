import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}) {
  const dialogRef = useRef(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${maxWidth} bg-surface border border-line rounded-lg shadow-2xl shadow-black/50 overflow-hidden transition-transform animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 id="modal-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
