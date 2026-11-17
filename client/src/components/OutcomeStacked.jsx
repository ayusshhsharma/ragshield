export default function OutcomeStacked({ outcomes = {}, className = '' }) {
  const items = [
    {
      key: 'attack_succeeded',
      label: 'Attack succeeded',
      count: outcomes.attack_succeeded || 0,
      bg: 'bg-danger',
      text: 'text-danger',
    },
    {
      key: 'blocked_by_defense',
      label: 'Blocked',
      count: outcomes.blocked_by_defense || 0,
      bg: 'bg-success',
      text: 'text-success',
    },
    {
      key: 'model_refused_or_safe',
      label: 'Safe / refused',
      count: outcomes.model_refused_or_safe || 0,
      bg: 'bg-info',
      text: 'text-info',
    },
    {
      key: 'benign_answered',
      label: 'Answered',
      count: outcomes.benign_answered || 0,
      bg: 'bg-muted',
      text: 'text-muted',
    },
    {
      key: 'error',
      label: 'Error',
      count: outcomes.error || 0,
      bg: 'bg-warning',
      text: 'text-warning',
    },
  ];

  const total = items.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div
      data-testid="outcome-stacked-bar"
      className={`bg-surface border border-line rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
          Outcome Distribution
        </h3>
        <span className="text-xs font-mono text-muted">
          Total results: <strong className="text-ink">{total}</strong>
        </span>
      </div>

      {total === 0 ? (
        <div className="h-5 bg-elevated rounded flex items-center justify-center text-[11px] text-muted font-mono">
          No outcome data available yet
        </div>
      ) : (
        <>
          {/* Stacked bar container */}
          <div
            className="h-6 w-full bg-elevated rounded overflow-hidden flex"
            role="progressbar"
            aria-valuenow={total}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Outcome distribution bar"
          >
            {items.map((item) => {
              if (item.count === 0) return null;
              const pct = (item.count / total) * 100;
              return (
                <div
                  key={item.key}
                  style={{ width: `${pct}%` }}
                  title={`${item.label}: ${item.count} (${pct.toFixed(1)}%)`}
                  className={`${item.bg} h-full transition-all duration-300 relative group flex items-center justify-center text-[10px] font-mono font-bold text-base overflow-hidden px-1`}
                >
                  {pct >= 8 && `${pct.toFixed(0)}%`}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono">
            {items.map((item) => {
              const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${item.bg}`} aria-hidden="true" />
                  <span className="text-muted">{item.label}:</span>
                  <span className={`font-semibold ${item.text}`}>{item.count}</span>
                  <span className="text-muted/60 text-[11px]">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
