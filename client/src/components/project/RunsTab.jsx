import {
  ArrowRight,
  Info,
  Layers,
  Play,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext.jsx';
import api from '../../services/api.js';
import { formatPercentTable } from '../../utils/format.js';
import Badge from '../Badge.jsx';
import Button from '../Button.jsx';
import EmptyState from '../EmptyState.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import ProgressBar from '../ProgressBar.jsx';
import RunStatusBadge from '../RunStatusBadge.jsx';
import Spinner from '../Spinner.jsx';
import RunOptionsModal from './RunOptionsModal.jsx';

export default function RunsTab({ project }) {
  const toast = useToast();

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('baseline');

  const fetchRuns = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/projects/${project.id}/runs`);
      setRuns(res.data.items || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load runs';
      setError(msg);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchRuns(true);
  }, [fetchRuns]);

  // Polling: every 2 s ONLY while any run is 'queued' or 'running'; clear on unmount
  const hasActiveRuns = runs.some(
    (r) => r.status === 'queued' || r.status === 'running',
  );

  useEffect(() => {
    if (!hasActiveRuns) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const res = await api.get(`/projects/${project.id}/runs`);
        setRuns(res.data.items || []);
      } catch {
        // Silently skip transient polling errors
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [hasActiveRuns, project.id]);

  const handleOpenModal = (mode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleLaunchRun = async (mode, options) => {
    if (mode === 'experiment') {
      const res = await api.post(`/projects/${project.id}/experiments`, options);
      toast.success('Comparative experiment launched.');
      await fetchRuns(false);
      return res.data;
    } else {
      const res = await api.post(`/projects/${project.id}/runs`, {
        mode,
        ...options,
      });
      toast.success(`${mode === 'baseline' ? 'Baseline' : 'Protected'} run queued.`);
      await fetchRuns(false);
      return res.data;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dismissible Synthetic-Data Safety Banner (docs/design.md §6) */}
      {!bannerDismissed && (
        <div
          role="status"
          data-testid="synthetic-data-banner"
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-info/10 border border-info/30 text-xs text-info"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>All secrets and customer data in this tool are synthetic.</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss notice"
            className="p-1 rounded text-info/80 hover:text-info hover:bg-info/20 focus:outline-none focus:ring-2 focus:ring-brand shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink">
              Evaluation Runs & Experiments
            </h2>
            <Badge variant="brand">{runs.length} Runs</Badge>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Execute baseline and protected prompt-injection attack test suites to measure empirical security metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal('baseline')}
          >
            Run Baseline
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal('protected')}
          >
            Run Protected
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleOpenModal('experiment')}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Run Experiment
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fetchRuns(true)}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-16 bg-surface border border-line rounded-lg space-y-2">
          <Spinner size="md" className="text-brand" />
          <p className="text-xs font-mono text-muted">Loading test runs...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && runs.length === 0 && (
        <EmptyState
          icon={Zap}
          title="No evaluation runs executed yet"
          description="Launch a baseline run to establish raw vulnerability rates, or run an experiment to compare baseline vs protected defenses."
          action={
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleOpenModal('baseline')}
              >
                Run Baseline
              </Button>
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={() => handleOpenModal('experiment')}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Run Experiment
              </Button>
            </div>
          }
        />
      )}

      {/* Runs Table */}
      {!loading && !error && runs.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/60 text-muted border-b border-line uppercase font-mono tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Run ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Mode</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium min-w-[130px]">Progress</th>
                  <th scope="col" className="px-4 py-3 font-medium">ASR</th>
                  <th scope="col" className="px-4 py-3 font-medium">FPR</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => {
                  const progressTotal = r.progress?.total || 0;
                  const progressCompleted = r.progress?.completed || 0;
                  const asrValue =
                    r.metrics?.asr?.mean != null
                      ? r.metrics.asr.mean
                      : r.metrics?.attackSuccessRate != null
                        ? r.metrics.attackSuccessRate * 100
                        : null;
                  const fprValue =
                    r.metrics?.benign?.fpr != null
                      ? r.metrics.benign.fpr
                      : r.metrics?.falsePositiveRate != null
                        ? r.metrics.falsePositiveRate * 100
                        : null;
                  const asr = formatPercentTable(asrValue);
                  const fpr = formatPercentTable(fprValue);

                  const formattedDate = r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-elevated/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-brand-hover">
                        <Link
                          to={`/runs/${r.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {r.id.slice(0, 10)}...
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={r.mode === 'protected' ? 'brand' : 'muted'}
                          size="xs"
                        >
                          {r.mode}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <RunStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar
                          value={progressCompleted}
                          max={progressTotal || 1}
                          showLabel={r.status === 'running' || r.status === 'queued'}
                          barClassName={
                            r.status === 'completed'
                              ? 'bg-success'
                              : r.status === 'failed'
                              ? 'bg-danger'
                              : 'bg-brand'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-ink">
                        {asr}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">
                        {fpr}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.experimentId && (
                            <Link
                              to={`/experiments/${r.experimentId}`}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-brand hover:underline"
                              title="View Experiment Comparison"
                            >
                              <Layers className="w-3 h-3" />
                              Compare
                            </Link>
                          )}
                          <Link
                            to={`/runs/${r.id}`}
                            className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                          >
                            Details
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Options Modal */}
      <RunOptionsModal
        isOpen={modalOpen}
        mode={modalMode}
        project={project}
        onClose={() => setModalOpen(false)}
        onSubmit={handleLaunchRun}
      />
    </div>
  );
}
