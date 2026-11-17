import { Info } from 'lucide-react';
import { useState } from 'react';

export default function StatCard({
  label,
  value,
  subtext = null,
  tooltip = null,
  variant = 'default',
  className = '',
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const valueColors = {
    default: 'text-ink',
    danger: 'text-danger',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-info',
    muted: 'text-muted',
    brand: 'text-brand',
  };

  const valueClass = valueColors[variant] || valueColors.default;

  return (
    <div
      className={`bg-surface border border-line rounded-lg p-4 relative flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted truncate">{label}</span>
        {tooltip && (
          <div className="relative inline-flex items-center">
            <button
              type="button"
              className="text-muted/70 hover:text-ink focus:outline-none focus:ring-1 focus:ring-brand rounded-full p-0.5"
              aria-label={`Info about ${label}`}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {showTooltip && (
              <div
                role="tooltip"
                className="absolute right-0 bottom-full mb-1.5 z-30 w-52 p-2 bg-elevated border border-line rounded-md text-[11px] text-ink shadow-xl pointer-events-none leading-relaxed"
              >
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono tracking-tight ${valueClass}`}>
          {value}
        </span>
        {subtext && (
          <span className="text-xs font-mono text-muted truncate">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}
