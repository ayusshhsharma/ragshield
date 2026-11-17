import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ExternalLink,
  GitCompare,
  Info,
  Shield,
  ShieldOff,
  Timer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import AsrByCategory from '../components/Charts/AsrByCategory.jsx';
import OutcomeStackedChart, {
  deriveStackedOutcomes,
} from '../components/Charts/OutcomeStacked.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import ExperimentMetricTable from '../components/ExperimentMetricTable.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import RunStatusBadge from '../components/RunStatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import api from '../services/api.js';

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getEnabledDefenseLabels(defenseConfig) {
  if (!defenseConfig) return [];
  const labels = [];
  if (defenseConfig.inputScanner?.enabled) labels.push('DF-01 Input');
  if (defenseConfig.documentScanner?.enabled) labels.push('DF-02 Docs');
  if (defenseConfig.instructionIsolation?.enabled) labels.push('DF-03 Isolation');
  if (defenseConfig.outputValidator?.enabled) labels.push('DF-05 Output');
  return labels;
}

export default function ExperimentComparePage() {
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pollTimerRef = useRef(null);

  const fetchExperiment = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await api.get(`/experiments/${id}`);
        setData(res.data);
        return res.data;
      } catch (err) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to load experiment comparison.';
        if (!silent) {
          setError(msg);
        }
        return null;
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    fetchExperiment();
  }, [fetchExperiment]);

  const experiment = data?.experiment || null;
  const baselineRun = data?.baselineRun || null;
  const protectedRun = data?.protectedRun || null;
  const comparison = data?.comparison || null;

  const isRunActive = (run) =>
    run && (run.status === 'queued' || run.status === 'running');

  const isActive =
    experiment?.status === 'queued' ||
    experiment?.status === 'running' ||
    isRunActive(baselineRun) ||
    isRunActive(protectedRun);

  const isReadyForCharts =
    !isActive &&
    baselineRun?.status === 'completed' &&
    protectedRun?.status === 'completed' &&
    Boolean(comparison);

  // Poll every 2 s while experiment or either run is active
  useEffect(() => {
    if (!isActive) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }

    pollTimerRef.current = setInterval(async () => {
      const updated = await fetchExperiment({ silent: true });
      const expStatus = updated?.experiment?.status;
      const bStatus = updated?.baselineRun?.status;
      const pStatus = updated?.protectedRun?.status;
      const stillRunning =
        expStatus === 'queued' ||
        expStatus === 'running' ||
        bStatus === 'queued' ||
        bStatus === 'running' ||
        pStatus === 'queued' ||
        pStatus === 'running';

      if (!stillRunning && pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isActive, fetchExperiment]);

  const outcomeRows = useMemo(() => {
    if (!baselineRun?.metrics || !protectedRun?.metrics) return [];
    return [
      {
        label: 'Baseline',
        outcomes: deriveStackedOutcomes(baselineRun.metrics),
      },
      {
        label: 'Protected',
        outcomes: deriveStackedOutcomes(protectedRun.metrics),
      },
    ];
  }, [baselineRun, protectedRun]);

  if (loading && !experiment) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="text-sm text-muted mt-3">Loading experiment comparison...</p>
      </div>
    );
  }

  if (error && !experiment) {
    return (
      <div className="space-y-4">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Projects
        </Link>
        <ErrorBanner message={error} />
        <div>
          <Button variant="secondary" onClick={() => fetchExperiment()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!experiment) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Experiment not found"
        description="The requested experiment does not exist or you do not have permission to view it."
        action={
          <Link to="/projects">
            <Button variant="secondary">Back to Projects</Button>
          </Link>
        }
      />
    );
  }

  const baselineId = baselineRun?.id || experiment.baselineRunId;
  const protectedId = protectedRun?.id || experiment.protectedRunId;
  const enabledDefenses = getEnabledDefenseLabels(
    protectedRun?.defenseConfigSnapshot,
  );
  const overheadMs = comparison?.defenseOverheadMs ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link
              to={
                experiment.projectId
                  ? `/projects/${experiment.projectId}/runs`
                  : '/projects'
              }
              className="inline-flex items-center gap-1 hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to Runs
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-ink tracking-tight flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-brand" aria-hidden="true" />
              Experiment Comparison
            </h1>
            <RunStatusBadge status={experiment.status} />
            <span className="text-xs font-mono text-muted">
              ID: {experiment.id}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted">
            <span>
              Model:{' '}
              <strong className="text-ink">
                {baselineRun?.llm?.model || protectedRun?.llm?.model || 'mock'}
              </strong>
            </span>
            <span>Repeats: {baselineRun?.repeats || protectedRun?.repeats || 1}</span>
            <span>Cases: {baselineRun?.caseIds?.length ?? '—'}</span>
            <span>Created: {formatDateTime(experiment.createdAt)}</span>
          </div>
        </div>

        {/* Direct Links to Both Run Details */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {baselineId && (
            <Link to={`/runs/${baselineId}`}>
              <Button variant="secondary" size="sm">
                <ShieldOff className="w-3.5 h-3.5 mr-1.5 text-muted" aria-hidden="true" />
                Baseline Run
                <ExternalLink className="w-3 h-3 ml-1.5 text-muted" aria-hidden="true" />
              </Button>
            </Link>
          )}
          {protectedId && (
            <Link to={`/runs/${protectedId}`}>
              <Button variant="secondary" size="sm">
                <Shield className="w-3.5 h-3.5 mr-1.5 text-brand" aria-hidden="true" />
                Protected Run
                <ExternalLink className="w-3 h-3 ml-1.5 text-muted" aria-hidden="true" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Unfinished or failed experiment state — show progress, NO charts */}
      {!isReadyForCharts ? (
        <div className="space-y-4" data-testid="experiment-in-progress">
          {isActive ? (
            <Card className="p-5 border-brand/40 bg-brand/5">
              <div className="flex items-start gap-3">
                <Spinner size="sm" className="mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Experiment in progress
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Baseline and protected suites execute sequentially on the exact same
                    attack cases and repeat count. Comparison metrics and charts will appear
                    automatically once both runs complete.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5 border-warning/40 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="w-5 h-5 text-warning shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Comparison unavailable
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Both baseline and protected runs must finish with status{' '}
                    <code className="font-mono text-ink">completed</code> before comparative
                    metrics and charts can be rendered. Inspect the individual runs below for details.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Individual Run Progress Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Baseline Run Progress */}
            <Card className="p-5 space-y-3" data-testid="baseline-progress-card">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldOff className="w-4 h-4 text-muted" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">
                    1. Baseline Run
                  </h3>
                </div>
                <RunStatusBadge status={baselineRun?.status || 'queued'} />
              </div>

              <p className="text-xs text-muted">
                All defense layers disabled (unprotected control run).
              </p>

              <ProgressBar
                value={baselineRun?.progress?.completed ?? 0}
                max={baselineRun?.progress?.total ?? 0}
                showLabel
              />

              {baselineId && (
                <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted truncate">ID: {baselineId}</span>
                  <Link
                    to={`/runs/${baselineId}`}
                    className="text-brand hover:text-brand-hover inline-flex items-center gap-1"
                  >
                    Inspect Run
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </Card>

            {/* Protected Run Progress */}
            <Card className="p-5 space-y-3" data-testid="protected-progress-card">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-brand" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">
                    2. Protected Run
                  </h3>
                </div>
                <RunStatusBadge status={protectedRun?.status || 'queued'} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {enabledDefenses.length > 0 ? (
                  enabledDefenses.map((d) => (
                    <Badge key={d} variant="brand" size="xs">
                      {d}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted">Configured project defenses</span>
                )}
              </div>

              <ProgressBar
                value={protectedRun?.progress?.completed ?? 0}
                max={protectedRun?.progress?.total ?? 0}
                showLabel
              />

              {protectedId && (
                <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted truncate">ID: {protectedId}</span>
                  <Link
                    to={`/runs/${protectedId}`}
                    className="text-brand hover:text-brand-hover inline-flex items-center gap-1"
                  >
                    Inspect Run
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* Completed experiment: Defense Overhead Card, Metric Table, Charts, Limitations */
        <div className="space-y-6" data-testid="experiment-results">
          {/* Top Highlight Row: Defense Overhead Card & Run Config Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Defense Overhead Card */}
            <Card
              className="p-5 flex flex-col justify-between lg:col-span-1 border-line"
              data-testid="defense-overhead-card"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-warning" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-ink">
                    Defense Overhead
                  </h2>
                </div>
                <Badge variant={overheadMs > 0 ? 'warning' : 'muted'} size="xs">
                  Latency Delta
                </Badge>
              </div>

              <div className="my-2">
                <div
                  className={`text-3xl font-bold font-mono tracking-tight ${
                    overheadMs > 0 ? 'text-warning' : 'text-ink'
                  }`}
                >
                  {overheadMs > 0 ? '+' : ''}
                  {Number(overheadMs).toFixed(1)} ms
                </div>
                <p className="text-xs text-muted mt-1">
                  Protected avg latency minus baseline avg latency
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-line/60 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted block text-[11px]">Baseline avg</span>
                  <span className="text-ink font-semibold">
                    {Math.round(comparison.avgLatency?.baseline ?? 0)} ms
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Protected avg</span>
                  <span className="text-ink font-semibold">
                    {Math.round(comparison.avgLatency?.protected ?? 0)} ms
                  </span>
                </div>
              </div>
              {protectedRun?.metrics?.latency?.avgDefenseMs > 0 && (
                <div className="mt-2 text-[11px] font-mono text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  Direct scanner/validator time:{' '}
                  <strong className="text-ink">
                    {Number(protectedRun.metrics.latency.avgDefenseMs).toFixed(1)} ms
                  </strong>
                </div>
              )}
            </Card>

            {/* Active Defenses & Paired Run Cards */}
            <Card className="p-5 lg:col-span-2 flex flex-col justify-between space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink mb-2">
                  Paired Evaluation Runs
                </h2>
                <p className="text-xs text-muted leading-relaxed">
                  Both runs evaluated{' '}
                  <strong className="text-ink font-mono">
                    {baselineRun.caseIds?.length || 0}
                  </strong>{' '}
                  identical test cases across{' '}
                  <strong className="text-ink font-mono">
                    {baselineRun.repeats || 1}
                  </strong>{' '}
                  repeat(s). Active defenses applied to the protected run:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {enabledDefenses.length > 0 ? (
                    enabledDefenses.map((d) => (
                      <Badge key={d} variant="brand" size="xs">
                        {d}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="muted" size="xs">
                      None
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Link
                  to={`/runs/${baselineId}`}
                  className="bg-base border border-line hover:border-brand/60 rounded-md p-3 transition-colors group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink group-hover:text-brand">
                      Baseline Run Details
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-brand" />
                  </div>
                  <div className="text-[11px] font-mono text-muted mt-1">
                    ASR: {Number(comparison.asr?.baseline ?? 0).toFixed(1)}% · ID:{' '}
                    {baselineId?.slice(0, 10)}…
                  </div>
                </Link>

                <Link
                  to={`/runs/${protectedId}`}
                  className="bg-base border border-line hover:border-brand/60 rounded-md p-3 transition-colors group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink group-hover:text-brand">
                      Protected Run Details
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-brand" />
                  </div>
                  <div className="text-[11px] font-mono text-muted mt-1">
                    ASR: {Number(comparison.asr?.protected ?? 0).toFixed(1)}% · ID:{' '}
                    {protectedId?.slice(0, 10)}…
                  </div>
                </Link>
              </div>
            </Card>
          </div>

          {/* Two-Column Metric Table with Colored Deltas */}
          <ExperimentMetricTable
            comparison={comparison}
            baselineMetrics={baselineRun.metrics}
            protectedMetrics={protectedRun.metrics}
          />

          {/* Charts: ASR by Category & Stacked Outcome Bars */}
          <div className="grid grid-cols-1 gap-6">
            <AsrByCategory
              perCategory={comparison.perCategory}
              baselinePerCategory={baselineRun.metrics?.perCategory}
              protectedPerCategory={protectedRun.metrics?.perCategory}
            />

            <OutcomeStackedChart rows={outcomeRows} />
          </div>

          {/* Limitations Footnote */}
          <Card
            className="p-4 bg-base/60 border-line/80"
            data-testid="limitations-footnote"
          >
            <div className="flex items-start gap-2.5">
              <Info
                className="w-4 h-4 text-muted shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1.5 text-xs text-muted leading-relaxed">
                <h3 className="font-semibold text-ink">
                  Evaluation Methodology &amp; Limitations
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    Outcomes are scored with deterministic keyword and pattern checks; edge
                    cases where a model echoes forbidden strings inside a refusal are flagged as{' '}
                    <code className="font-mono text-ink">ambiguous</code> for manual review.
                  </li>
                  <li>
                    Indirect document injections are simulated at context-assembly time to
                    guarantee payload delivery; vector-retrieval rank manipulation is out of scope.
                  </li>
                  <li>
                    Heuristic scanners (DF-01 / DF-02) and output validators (DF-05) are layered
                    mitigations, not complete solutions—paraphrasing, novel encodings, or unsupported
                    languages can bypass regex-based detection.
                  </li>
                  <li>
                    All customer records, canary tokens, and secrets in the demo knowledge base are
                    entirely synthetic. Infrastructure errors are excluded from rate denominators.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
