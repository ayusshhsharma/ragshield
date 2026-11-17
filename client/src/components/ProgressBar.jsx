export default function ProgressBar({
  value = 0,
  max = 100,
  showLabel = false,
  className = '',
  barClassName = 'bg-brand',
}) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-[11px] font-mono text-muted">
          <span>
            {value} / {max}
          </span>
          <span>{percentage}%</span>
        </div>
      )}
      <div className="w-full bg-base border border-line rounded-full overflow-hidden h-2">
        <div
          className={`h-full transition-all duration-300 ${barClassName}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
