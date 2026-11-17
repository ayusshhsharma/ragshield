import StatCard from './StatCard.jsx';

export default function MetricGrid({ metrics, repeats = 1, className = '' }) {
  if (!metrics) {
    return null;
  }

  const {
    asr = { mean: 0, min: 0, max: 0 },
    blockingRate = 0,
    safeRate = 0,
    benign = { fpr: 0, successRate: 0 },
    latency = { avgMs: 0, avgDefenseMs: 0 },
    totals = { errors: 0, eligibleBenignRuns: 0 },
    ambiguousCount = 0,
    providerBlockedCount = 0,
  } = metrics;

  const hasBenign = (totals?.eligibleBenignRuns ?? 0) > 0 || (totals?.benignRuns ?? 0) > 0;
  const asrRange =
    repeats > 1 || asr.min !== asr.max
      ? `[${Number(asr.min ?? 0).toFixed(1)}% – ${Number(asr.max ?? 0).toFixed(1)}%]`
      : null;

  const formattedLatency =
    (latency.avgMs ?? 0) >= 1000
      ? `${(latency.avgMs / 1000).toFixed(2)} s`
      : `${Math.round(latency.avgMs ?? 0)} ms`;

  return (
    <div
      data-testid="metric-grid"
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 ${className}`}
    >
      <StatCard
        label="Attack Success Rate"
        value={`${Number(asr.mean ?? 0).toFixed(1)}%`}
        subtext={asrRange}
        variant={asr.mean > 0 ? 'danger' : 'success'}
        tooltip="Attack Success Rate (ASR): percentage of eligible attack runs where the prompt injection succeeded."
      />

      <StatCard
        label="Blocking Rate"
        value={`${Number(blockingRate ?? 0).toFixed(1)}%`}
        variant={blockingRate > 0 ? 'success' : 'muted'}
        tooltip="Blocking rate: percentage of eligible attack runs stopped by an active defense layer."
      />

      <StatCard
        label="Safe / Refused Rate"
        value={`${Number(safeRate ?? 0).toFixed(1)}%`}
        variant="info"
        tooltip="Safe rate: percentage of eligible attack runs where the model safely refused or did not satisfy the attack condition."
      />

      <StatCard
        label="False Positive Rate"
        value={hasBenign ? `${Number(benign.fpr ?? 0).toFixed(1)}%` : 'N/A'}
        variant={hasBenign && benign.fpr > 0 ? 'warning' : 'default'}
        tooltip="False Positive Rate (FPR): percentage of benign queries mistakenly blocked by active defenses."
      />

      <StatCard
        label="Benign Success Rate"
        value={hasBenign ? `${Number(benign.successRate ?? 0).toFixed(1)}%` : 'N/A'}
        variant={hasBenign ? 'success' : 'default'}
        tooltip="Benign Success Rate: percentage of benign queries answered accurately with expected keywords."
      />

      <StatCard
        label="Avg Latency"
        value={formattedLatency}
        subtext={
          latency.avgDefenseMs > 0
            ? `+${Math.round(latency.avgDefenseMs)} ms defense`
            : null
        }
        tooltip="Average end-to-end response latency for non-error requests."
      />

      <StatCard
        label="Errors"
        value={String(totals.errors ?? 0)}
        variant={totals.errors > 0 ? 'warning' : 'muted'}
        tooltip="Count of infrastructure or timeout errors excluded from all evaluation denominators."
      />

      <StatCard
        label="Ambiguous Cases"
        value={String(ambiguousCount ?? 0)}
        variant={ambiguousCount > 0 ? 'warning' : 'muted'}
        tooltip="Attacks where the output matched the success condition but also contained a refusal phrase."
      />

      <StatCard
        label="Provider Blocked"
        value={String(providerBlockedCount ?? 0)}
        variant={providerBlockedCount > 0 ? 'info' : 'muted'}
        tooltip="Requests blocked upstream by the LLM provider's safety filter returning empty content."
      />
    </div>
  );
}
