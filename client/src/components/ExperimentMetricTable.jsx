import { ArrowDownRight, ArrowUpRight, HelpCircle, Minus } from 'lucide-react';
import { formatLatency, formatPercentTable } from '../utils/format.js';
import Card from './Card.jsx';

function DeltaBadge({
  delta,
  kind = 'percent',
  invert = false,
  isNeutral = false,
}) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) {
    return <span className="text-muted font-mono">—</span>;
  }

  const num = Number(delta);
  if (num === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted font-mono font-medium">
        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
        {kind === 'latency' ? '0 ms' : '0.00%'}
      </span>
    );
  }

  // Normally positive is good (green), negative is bad (red)
  // If invert=true (e.g. ASR, FPR): negative is good (green), positive is bad (red)
  let colorClass = 'text-muted';
  if (isNeutral) {
    colorClass = num > 0 ? 'text-warning' : 'text-muted';
  } else if (invert) {
    colorClass = num < 0 ? 'text-success' : 'text-danger';
  } else {
    colorClass = num > 0 ? 'text-success' : 'text-danger';
  }

  const Icon = num > 0 ? ArrowUpRight : ArrowDownRight;
  const formatted =
    kind === 'latency'
      ? formatLatency(num, { signed: true })
      : `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono font-bold ${colorClass}`}
      data-testid="delta-badge"
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {formatted}
    </span>
  );
}

export default function ExperimentMetricTable({
  comparison = null,
  baselineMetrics = null,
  protectedMetrics = null,
  className = '',
}) {
  if (!comparison) {
    return null;
  }

  const b = baselineMetrics || {};
  const p = protectedMetrics || {};

  const bSafe = b.safeRate ?? 0;
  const pSafe = p.safeRate ?? 0;
  const safeDelta = Number((pSafe - bSafe).toFixed(2));

  const bDetection = b.detectionRate ?? 0;
  const pDetection = p.detectionRate ?? 0;
  const detectionDelta = Number((pDetection - bDetection).toFixed(2));

  const rows = [
    {
      key: 'asr',
      label: 'Attack Success Rate (ASR)',
      tooltip:
        'Percentage of eligible attack runs where the prompt injection succeeded. Lower is better.',
      baseline: formatPercentTable(comparison.asr?.baseline ?? 0),
      protected: formatPercentTable(comparison.asr?.protected ?? 0),
      delta: comparison.asr?.delta,
      kind: 'percent',
      invert: true, // Lower ASR = good (green)
    },
    {
      key: 'blockingRate',
      label: 'Blocking Rate',
      tooltip:
        'Percentage of eligible attack runs stopped by an active defense layer. Higher is better.',
      baseline: formatPercentTable(comparison.blockingRate?.baseline ?? 0),
      protected: formatPercentTable(comparison.blockingRate?.protected ?? 0),
      delta: comparison.blockingRate?.delta,
      kind: 'percent',
      invert: false, // Higher blocking = good (green)
    },
    {
      key: 'safeRate',
      label: 'Safe / Refused Rate',
      tooltip:
        'Percentage of eligible attack runs where the model safely refused or did not satisfy the injection condition.',
      baseline: formatPercentTable(bSafe),
      protected: formatPercentTable(pSafe),
      delta: safeDelta,
      kind: 'percent',
      invert: false,
    },
    {
      key: 'detectionRate',
      label: 'Detection Rate',
      tooltip:
        'Percentage of attacks that triggered at least one defense scanner or validator.',
      baseline: formatPercentTable(bDetection),
      protected: formatPercentTable(pDetection),
      delta: detectionDelta,
      kind: 'percent',
      invert: false,
    },
    {
      key: 'fpr',
      label: 'False Positive Rate (FPR)',
      tooltip:
        'Percentage of benign queries incorrectly blocked by defenses. Higher is bad (red).',
      baseline: formatPercentTable(comparison.fpr?.baseline ?? 0),
      protected: formatPercentTable(comparison.fpr?.protected ?? 0),
      delta: comparison.fpr?.delta,
      kind: 'percent',
      invert: true, // Higher FPR = bad (red)
    },
    {
      key: 'benignSuccessRate',
      label: 'Benign Success Rate',
      tooltip:
        'Percentage of benign queries answered accurately with expected keywords.',
      baseline: formatPercentTable(comparison.benignSuccessRate?.baseline ?? 0),
      protected: formatPercentTable(comparison.benignSuccessRate?.protected ?? 0),
      delta: comparison.benignSuccessRate?.delta,
      kind: 'percent',
      invert: false, // Higher benign success = good (green)
    },
    {
      key: 'latency',
      label: 'Average Latency',
      tooltip:
        'Mean end-to-end response latency for non-error requests. Extra latency is defense overhead.',
      baseline: formatLatency(comparison.avgLatency?.baseline ?? 0),
      protected: formatLatency(comparison.avgLatency?.protected ?? 0),
      delta: comparison.defenseOverheadMs ?? comparison.avgLatency?.delta,
      kind: 'latency',
      isNeutral: true, // Latency overhead is neutral/warning
    },
  ];

  return (
    <Card
      className={`p-0 overflow-hidden ${className}`}
      data-testid="experiment-metric-table"
    >
      <div className="px-5 py-4 border-b border-line bg-elevated/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Comparative Metric Summary
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Direct comparison between unprotected baseline and protected runs across identical test cases.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono shrink-0">
          <span className="flex items-center gap-1 text-success">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            Improvement
          </span>
          <span className="flex items-center gap-1 text-danger">
            <span className="w-2 h-2 rounded-full bg-danger inline-block" />
            Regression
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-elevated/20 text-[11px] font-mono uppercase tracking-wider text-muted">
              <th className="py-3 px-5">Metric</th>
              <th className="py-3 px-5 text-right">Baseline</th>
              <th className="py-3 px-5 text-right">Protected</th>
              <th className="py-3 px-5 text-right">Delta (Net Effect)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs font-mono">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-elevated/40 transition-colors">
                <td className="py-3.5 px-5 font-sans">
                  <div className="flex items-center gap-1.5 font-medium text-ink">
                    <span>{row.label}</span>
                    <span
                      title={row.tooltip}
                      className="text-muted/70 hover:text-ink cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </td>
                <td className="py-3.5 px-5 text-right text-muted whitespace-nowrap">
                  {row.baseline}
                </td>
                <td className="py-3.5 px-5 text-right text-ink font-semibold whitespace-nowrap">
                  {row.protected}
                </td>
                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                  <DeltaBadge
                    delta={row.delta}
                    kind={row.kind}
                    invert={row.invert}
                    isNeutral={row.isNeutral}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
