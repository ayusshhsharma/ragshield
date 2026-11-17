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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload || {};

  return (
    <div className="bg-elevated border border-line rounded-md p-3 shadow-xl text-xs font-mono space-y-1.5">
      <div className="font-semibold text-ink border-b border-line/60 pb-1">
        {label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="w-2 h-2 rounded-sm bg-danger inline-block" />
          Baseline ASR:
        </span>
        <span className="text-danger font-semibold">
          {Number(row.baseline ?? 0).toFixed(1)}%
          {typeof row.baselineRuns === 'number' ? ` (n=${row.baselineRuns})` : ''}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="w-2 h-2 rounded-sm bg-success inline-block" />
          Protected ASR:
        </span>
        <span className="text-success font-semibold">
          {Number(row.protected ?? 0).toFixed(1)}%
          {typeof row.protectedRuns === 'number' ? ` (n=${row.protectedRuns})` : ''}
        </span>
      </div>
      <div className="pt-1 border-t border-line/60 flex items-center justify-between gap-4">
        <span className="text-muted">Delta:</span>
        <span
          className={
            row.delta < 0
              ? 'text-success font-semibold'
              : row.delta > 0
                ? 'text-danger font-semibold'
                : 'text-muted'
          }
        >
          {row.delta > 0 ? '+' : ''}
          {Number(row.delta ?? 0).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function AsrByCategory({
  perCategory = {},
  baselinePerCategory = {},
  protectedPerCategory = {},
  className = '',
}) {
  const categories = Object.keys(perCategory).sort();

  const data = categories.map((cat) => {
    const entry = perCategory[cat] || {};
    const bRuns = baselinePerCategory?.[cat]?.runs;
    const pRuns = protectedPerCategory?.[cat]?.runs;
    return {
      category: cat,
      baseline: Number(entry.baseline ?? 0),
      protected: Number(entry.protected ?? 0),
      delta: Number(entry.delta ?? 0),
      baselineRuns: typeof bRuns === 'number' ? bRuns : undefined,
      protectedRuns: typeof pRuns === 'number' ? pRuns : undefined,
    };
  });

  return (
    <Card className={`p-5 ${className}`} data-testid="asr-by-category-chart">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            ASR by Attack Category
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Lower Attack Success Rate (ASR) indicates stronger resistance to injection.
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted">
          Y-axis: 0–100%
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-base/40 border border-line/60 rounded text-xs text-muted font-mono">
          No per-category attack data available.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#263042"
                vertical={false}
              />
              <XAxis
                dataKey="category"
                tick={{ fill: '#9CA3AF', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}
                axisLine={{ stroke: '#263042' }}
                tickLine={{ stroke: '#263042' }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
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
              <Bar
                dataKey="baseline"
                name="Baseline ASR (%)"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
                animationDuration={250}
              />
              <Bar
                dataKey="protected"
                name="Protected ASR (%)"
                fill="#22C55E"
                radius={[4, 4, 0, 0]}
                animationDuration={250}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
