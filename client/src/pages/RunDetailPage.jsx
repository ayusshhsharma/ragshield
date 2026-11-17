import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Filter,
  GitCompare,
  Layers,
  Shield,
  Sliders,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import CodeBlock from '../components/CodeBlock.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import MetricGrid from '../components/MetricGrid.jsx';
import OutcomeBadge from '../components/OutcomeBadge.jsx';
import OutcomeStacked from '../components/OutcomeStacked.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ResultDetailDrawer from '../components/ResultDetailDrawer.jsx';
import RunStatusBadge from '../components/RunStatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../services/api.js';

const OUTCOME_OPTIONS = [
  { value: '', label: 'All outcomes' },
  { value: 'attack_succeeded', label: 'Attack succeeded' },
  { value: 'blocked_by_defense', label: 'Blocked' },
  { value: 'model_refused_or_safe', label: 'Safe / refused' },
  { value: 'benign_answered', label: 'Answered (benign)' },
  { value: 'error', label: 'Error' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'AT-01', label: 'AT-01 Direct injection' },
  { value: 'AT-02', label: 'AT-02 Indirect injection' },
  { value: 'AT-03', label: 'AT-03 System prompt extraction' },
  { value: 'AT-04', label: 'AT-04 Secret leakage' },
  { value: 'AT-05', label: 'AT-05 Role hijacking' },
  { value: 'AT-06', label: 'AT-06 Multilingual' },
  { value: 'AT-07', label: 'AT-07 Long context' },
  { value: 'AT-08', label: 'AT-08 Output exfiltration' },
  { value: 'BENIGN', label: 'BENIGN' },
];

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function RunDetailPage() {
  const { id } = useParams();
  const toast = useToast();

  // Run state
  const [run, setRun] = useState(null);
  const [loadingRun, setLoadingRun] = useState(true);
  const [runError, setRunError] = useState(null);

  // Results state
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loadingResults, setLoadingResults] = useState(true);
  const [resultsError, setResultsError] = useState(null);

  // Filters & Pagination
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // UI interactions
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const pollTimerRef = useRef(null);

  const fetchRun = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoadingRun(true);
        setRunError(null);
      }
      try {
        const res = await api.get(`/runs/${id}`);
        const fetchedRun = res.data?.run || res.data;
        setRun(fetchedRun);
        return fetchedRun;
      } catch (err) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to load run details.';
        if (!silent) {
          setRunError(msg);
        }
        return null;
      } finally {
        if (!silent) {
          setLoadingRun(false);
        }
      }
    },
    [id],
  );

  const fetchResults = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoadingResults(true);
        setResultsError(null);
      }
      try {
        const params = { page, limit };
        if (outcomeFilter) params.outcome = outcomeFilter;
        if (categoryFilter) params.category = categoryFilter;

        const res = await api.get(`/runs/${id}/results`, { params });
        setResults(res.data?.items || []);
        setTotalResults(res.data?.total ?? 0);
      } catch (err) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to load attack results.';
        if (!silent) {
          setResultsError(msg);
        }
      } finally {
        if (!silent) {
          setLoadingResults(false);
        }
      }
    },
    [id, page, limit, outcomeFilter, categoryFilter],
  );

  // Initial load of run
  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Load results whenever filters/page/id change
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Poll every 2 s while queued or running
  const isActive = run?.status === 'queued' || run?.status === 'running';

  useEffect(() => {
    if (!isActive) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return undefined;
    }

    pollTimerRef.current = setInterval(async () => {
      const updated = await fetchRun({ silent: true });
      await fetchResults({ silent: true });
      if (updated && updated.status !== 'queued' && updated.status !== 'running') {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isActive, fetchRun, fetchResults]);

  const handleCancelRun = async () => {
    setCancelling(true);
    try {
      const res = await api.post(`/runs/${id}/cancel`);
      const updatedRun = res.data?.run || res.data;
      setRun(updatedRun);
      toast.info('Run cancellation requested.');
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to cancel run.';
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/runs/${id}/report`, {
        responseType: 'blob',
      });
      const blob =
        res.data instanceof Blob
          ? res.data
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: 'application/json',
            });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ragshield-run-${id}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('JSON report downloaded.');
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to download JSON report.';
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  // Compute outcome distribution for OutcomeStacked
  const stackedOutcomes = useMemo(() => {
    if (!run?.metrics) return null;
    const m = run.metrics;
    const benignEligible = m.totals?.eligibleBenignRuns || 0;
    const benignBlocked =
      benignEligible > 0
        ? Math.round(((m.benign?.fpr || 0) / 100) * benignEligible)
        : 0;
    const benignAnswered = Math.max(0, benignEligible - benignBlocked);

    return {
      attack_succeeded: m.outcomes?.attack_succeeded || 0,
      blocked_by_defense: (m.outcomes?.blocked_by_defense || 0) + benignBlocked,
      model_refused_or_safe: m.outcomes?.model_refused_or_safe || 0,
      benign_answered: benignAnswered,
      error: m.totals?.errors || 0,
    };
  }, [run]);

  const totalPages = Math.max(1, Math.ceil(totalResults / limit));

  if (loadingRun && !run) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="text-sm text-muted mt-3">Loading run details...</p>
      </div>
    );
  }

  if (runError && !run) {
    return (
      <div className="space-y-4">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Projects
        </Link>
        <ErrorBanner message={runError} />
        <div>
          <Button variant="secondary" onClick={() => fetchRun()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Run not found"
        description="The requested evaluation run does not exist or you do not have permission to view it."
        action={
          <Link to="/projects">
            <Button variant="secondary">Back to Projects</Button>
          </Link>
        }
      />
    );
  }

  const ragSnap = run.ragConfigSnapshot || {};
  const defSnap = run.defenseConfigSnapshot || {};
  const defenseItems = [
    {
      id: 'DF-01',
      name: 'Input Scanner',
      enabled: Boolean(defSnap.inputScanner?.enabled),
      threshold: defSnap.inputScanner?.threshold,
    },
    {
      id: 'DF-02',
      name: 'Document Scanner',
      enabled: Boolean(defSnap.documentScanner?.enabled),
      threshold: defSnap.documentScanner?.threshold,
    },
    {
      id: 'DF-03',
      name: 'Instruction Isolation',
      enabled: Boolean(defSnap.instructionIsolation?.enabled),
    },
    {
      id: 'DF-05',
      name: 'Output Validator',
      enabled: Boolean(defSnap.outputValidator?.enabled),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link
              to={run.projectId ? `/projects/${run.projectId}/runs` : '/projects'}
              className="inline-flex items-center gap-1 hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to Runs
            </Link>
            {run.experimentId && (
              <>
                <span>•</span>
                <Link
                  to={`/experiments/${run.experimentId}`}
                  className="inline-flex items-center gap-1 text-brand hover:text-brand-hover"
                >
                  <GitCompare className="w-3.5 h-3.5" aria-hidden="true" />
                  View Experiment Comparison
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-ink tracking-tight">
              Run Detail
            </h1>
            <Badge
              variant={run.mode === 'protected' ? 'brand' : 'muted'}
              size="sm"
            >
              {run.mode === 'protected' ? 'Protected' : 'Baseline'}
            </Badge>
            <RunStatusBadge status={run.status} />
            <span className="text-xs font-mono text-muted">ID: {run.id}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted">
            <span>
              Model: <strong className="text-ink">{run.llm?.model || 'mock'}</strong>{' '}
              ({run.llm?.provider || 'mock'})
            </span>
            <span>Temp: {run.llm?.temperature ?? 0.2}</span>
            <span>Repeats: {run.repeats || 1}</span>
            <span>Started: {formatDateTime(run.startedAt || run.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isActive && (
            <Button
              variant="danger"
              size="sm"
              loading={cancelling}
              onClick={handleCancelRun}
              disabled={run.cancelRequested}
            >
              <Ban className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              {run.cancelRequested ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={downloading}
            onClick={handleDownloadReport}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Download JSON report
          </Button>
        </div>
      </div>

      {/* Active run progress bar */}
      {isActive && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink">
              Execution Progress
            </span>
            <span className="text-xs font-mono text-muted">
              {run.progress?.completed ?? 0} / {run.progress?.total ?? 0} cases completed
              {(run.progress?.errors ?? 0) > 0 && (
                <span className="text-warning ml-2">
                  ({run.progress.errors} errors)
                </span>
              )}
            </span>
          </div>
          <ProgressBar
            completed={run.progress?.completed ?? 0}
            total={run.progress?.total ?? 0}
            showLabel={false}
          />
        </Card>
      )}

      {/* Failure reason alert */}
      {run.status === 'failed' && run.failureReason && (
        <ErrorBanner message={`Run failed: ${run.failureReason}`} />
      )}

      {/* Config Snapshots Expander */}
      <Card className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSnapshots((prev) => !prev)}
          aria-expanded={showSnapshots}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-elevated/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand" aria-hidden="true" />
            <span className="text-sm font-medium text-ink">
              Configuration Snapshots
            </span>
            <span className="text-xs text-muted font-mono">
              (RAG parameters &amp; active defense layers)
            </span>
          </div>
          {showSnapshots ? (
            <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted" aria-hidden="true" />
          )}
        </button>

        {showSnapshots && (
          <div
            data-testid="config-snapshots-panel"
            className="border-t border-line p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-base/40"
          >
            {/* RAG Config */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                RAG Config Snapshot
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-surface border border-line rounded p-2.5">
                  <div className="text-muted text-[11px]">Chunk Size</div>
                  <div className="text-ink font-semibold mt-0.5">
                    {ragSnap.chunkSize ?? '—'}
                  </div>
                </div>
                <div className="bg-surface border border-line rounded p-2.5">
                  <div className="text-muted text-[11px]">Overlap</div>
                  <div className="text-ink font-semibold mt-0.5">
                    {ragSnap.chunkOverlap ?? '—'}
                  </div>
                </div>
                <div className="bg-surface border border-line rounded p-2.5">
                  <div className="text-muted text-[11px]">Top-K</div>
                  <div className="text-ink font-semibold mt-0.5">
                    {ragSnap.topK ?? '—'}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-muted mb-1">
                  System Prompt
                </div>
                <CodeBlock
                  code={ragSnap.systemPrompt || '(Default system prompt)'}
                  maxHeight="max-h-32"
                />
              </div>
            </div>

            {/* Defense Config */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                Defense Config Snapshot
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {defenseItems.map((d) => (
                  <div
                    key={d.id}
                    className="bg-surface border border-line rounded p-3 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-ink">
                        {d.id} {d.name}
                      </span>
                      <Badge
                        variant={d.enabled ? 'success' : 'muted'}
                        size="xs"
                      >
                        {d.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {typeof d.threshold === 'number' && (
                      <div className="text-[11px] font-mono text-muted">
                        Threshold: <strong className="text-ink">{d.threshold}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Metrics & Outcome Bar */}
      {run.metrics ? (
        <div className="space-y-4">
          <MetricGrid metrics={run.metrics} repeats={run.repeats} />
          <OutcomeStacked outcomes={stackedOutcomes} />
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">
            {isActive
              ? 'Aggregate metrics and outcome distributions will appear once the run completes.'
              : 'No aggregate metrics recorded for this run.'}
          </p>
        </Card>
      )}

      {/* Results section: filters + paginated table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">
              Per-Case Results ({totalResults})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="sr-only" htmlFor="filter-outcome">
              Filter by outcome
            </label>
            <select
              id="filter-outcome"
              aria-label="Filter by outcome"
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-surface border border-line rounded-md px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="filter-category">
              Filter by category
            </label>
            <select
              id="filter-category"
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="bg-surface border border-line rounded-md px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {(outcomeFilter || categoryFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOutcomeFilter('');
                  setCategoryFilter('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {resultsError && (
          <div className="space-y-2">
            <ErrorBanner message={resultsError} />
            <Button variant="secondary" size="sm" onClick={() => fetchResults()}>
              Retry
            </Button>
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          {loadingResults && results.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center">
              <Spinner size="md" />
              <p className="text-xs text-muted mt-2">Loading results...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ExternalLink}
                title="No results found"
                description={
                  outcomeFilter || categoryFilter
                    ? 'No results match your active filter criteria.'
                    : isActive
                      ? 'Results will stream in as test cases finish executing.'
                      : 'No test case results were recorded for this run.'
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-elevated/40 text-[11px] font-mono uppercase tracking-wider text-muted">
                      <th className="py-3 px-4">Case ID</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Repeat</th>
                      <th className="py-3 px-4">Query / Name</th>
                      <th className="py-3 px-4">Outcome</th>
                      <th className="py-3 px-4">Defenses</th>
                      <th className="py-3 px-4 text-right">Latency</th>
                      <th className="py-3 px-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {results.map((item) => (
                      <tr
                        key={item.id || `${item.caseId}-${item.repeatIndex}`}
                        onClick={() => setSelectedResult(item)}
                        className="hover:bg-elevated/60 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-ink whitespace-nowrap">
                          {item.caseId}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge variant="muted" size="xs">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted whitespace-nowrap">
                          #{item.repeatIndex}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-muted">
                          {item.caseSnapshot?.name ||
                            item.caseSnapshot?.userQuery ||
                            '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <OutcomeBadge outcome={item.outcome} size="xs" />
                            {item.ambiguous && (
                              <span
                                title="Ambiguous result"
                                className="text-warning"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.defensesTriggered?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.defensesTriggered.map((d, idx) => (
                                <Badge
                                  key={`${d.id}-${idx}`}
                                  variant="brand"
                                  size="xs"
                                >
                                  {d.id}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted/60 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted whitespace-nowrap">
                          {item.latencyMs ?? 0} ms
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Inspect ${item.caseId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResult(item);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-line bg-elevated/20 text-xs">
                <div className="flex items-center gap-2 text-muted font-mono">
                  <span>
                    Page <strong className="text-ink">{page}</strong> of{' '}
                    <strong className="text-ink">{totalPages}</strong>
                  </span>
                  <span>•</span>
                  <label htmlFor="page-size-select" className="sr-only">
                    Rows per page
                  </label>
                  <select
                    id="page-size-select"
                    aria-label="Rows per page"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-surface border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Result Drawer */}
      <ResultDetailDrawer
        isOpen={Boolean(selectedResult)}
        onClose={() => setSelectedResult(null)}
        result={selectedResult}
      />
    </div>
  );
}
