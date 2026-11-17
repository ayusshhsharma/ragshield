import { AlertCircle, X } from 'lucide-react';

export default function ErrorBanner({
  title,
  message,
  onDismiss,
  className = '',
}) {
  if (!message && !title) return null;

  return (
    <div
      role="alert"
      className={[
        'bg-danger/10 border border-danger/30 rounded-lg p-3.5 text-sm text-danger flex items-start gap-3',
        className,
      ].join(' ')}
    >
      <AlertCircle className="w-5 h-5 shrink-0 text-danger mt-0.5" aria-hidden="true" />

      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-danger">{title}</p>}
        {message && (
          <p className={`text-danger/90 ${title ? 'mt-0.5 text-xs' : ''}`}>
            {message}
          </p>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 -mr-1 rounded text-danger/70 hover:text-danger hover:bg-danger/20 transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
