import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../Card.jsx';

const OUTCOME_SERIES = [
  { key: 'attack_succeeded', label: 'Attack succeeded', color: '#EF4444' },
  { key: 'blocked_by_defense', label: 'Blocked', color: '#22C55E' },
  { key: 'model_refused_or_safe', label: 'Safe / refused', color: '#38BDF8' },
  { key: 'benign_answered', label: 'Answered', color: '#9CA3AF' },
  { key: 'error', label: 'Error', color: '#F59E0B' },
];

export function deriveStackedOutcomes(metrics) {
  if (!metrics) {
    return {
      attack_succeeded: 0,
      blocked_by_defense: 0,
      model_refused_or_safe: 0,
      benign_answered: 0,
      error: 0,
    };
  }
  const benignEligible = metrics.totals?.eligibleBenignRuns || 0;
  const benignBlocked =
    benignEligible > 0
      ? Math.round(((metrics.benign?.fpr || 0) / 100) * benignEligible)
      : 0;
  const benignAnswered = Math.max(0, benignEligible - benignBlocked);

  return {
    attack_succeeded: metrics.outcomes?.attack_succeeded || 0,
    blocked_by_defense: (metrics.outcomes?.blocked_by_defense || 0) + benignBlocked,
    model_refused_or_safe: metrics.outcomes?.model_refused_or_safe || 0,
    benign_answered: benignAnswered,
    error: metrics.totals?.errors || 0,
  };
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const rawRow = payload[0]?.payload || {};
  const total = rawRow._total || 0;

  return (
    <div className="bg-elevated border border-line rounded-md p-3 shadow-xl text-xs font-mono space-y-1.5">
      <div className="font-semibold text-ink border-b border-line/60 pb-1">
        {label} (n={total})
      </div>
      {OUTCOME_SERIES.map((series) => {
        const count = rawRow[`_count_${series.key}`] || 0;
        const pct = rawRow[series.key] || 0;
        return (
          <div key={series.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span
                className="w-2 h-2 rounded-sm inline-block"
                style={{ backgroundColor: series.color }}
              />
              {series.label}:
            </span>
            <span className="text-ink font-semibold">
              {count} ({Number(pct).toFixed(1)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OutcomeStackedChart({
  rows = [],
  title = 'Outcome Distribution Comparison',
  className = '',
}) {
  const chartData = rows.map((row) => {
    const o = row.outcomes || {};
    const total = OUTCOME_SERIES.reduce((acc, s) => acc + (o[s.key] || 0), 0);
    const entry = {
      name: row.label || row.mode || 'Run',
      _total: total,
    };

    for (const s of OUTCOME_SERIES) {
      const count = o[s.key] || 0;
      entry[`_count_${s.key}`] = count;
      entry[s.key] = total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
    }

    return entry;
  });

  const hasData = chartData.some((d) => d._total > 0);

  return (
    <Card className={`p-5 ${className}`} data-testid="outcome-stacked-chart">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="text-xs text-muted mt-0.5">
            Share of attack and benign outcomes across baseline vs protected modes.
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted">100% stacked</span>
      </div>

      {!hasData ? (
        <div className="h-44 flex items-center justify-center bg-base/40 border border-line/60 rounded text-xs text-muted font-mono">
          No outcome distribution data available.
        </div>
      ) : (
        <>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 12, bottom: 8 }}
                barSize={26}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#263042"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{
                    fill: '#9CA3AF',
                    fontSize: 11,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                  axisLine={{ stroke: '#263042' }}
                  tickLine={{ stroke: '#263042' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={84}
                  tick={{
                    fill: '#E5E7EB',
                    fontSize: 12,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                  axisLine={{ stroke: '#263042' }}
                  tickLine={{ stroke: '#263042' }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: '#E5E7EB' }}
                />
                {OUTCOME_SERIES.map((series) => (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    name={series.label}
                    stackId="outcomes"
                    fill={series.color}
                    animationDuration={250}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Text summary for quick scanning and accessibility */}
          <div className="mt-4 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {chartData.map((row) => (
              <div
                key={row.name}
                className="bg-base/50 border border-line/70 rounded p-2.5 space-y-1"
              >
                <div className="font-semibold text-ink flex items-center justify-between">
                  <span>{row.name}</span>
                  <span className="text-muted text-[11px]">n={row._total}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-danger">
                    Succeeded: {row._count_attack_succeeded} ({row.attack_succeeded.toFixed(1)}%)
                  </span>
                  <span className="text-success">
                    Blocked: {row._count_blocked_by_defense} ({row.blocked_by_defense.toFixed(1)}%)
                  </span>
                  <span className="text-info">
                    Safe: {row._count_model_refused_or_safe} ({row.model_refused_or_safe.toFixed(1)}%)
                  </span>
                  {row._count_benign_answered > 0 && (
                    <span className="text-muted">
                      Answered: {row._count_benign_answered} ({row.benign_answered.toFixed(1)}%)
                    </span>
                  )}
                  {row._count_error > 0 && (
                    <span className="text-warning">
                      Errors: {row._count_error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
