import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  FolderKanban,
  GitCompare,
  Play,
  Shield,
  ShieldOff,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import AsrByCategory from '../components/Charts/AsrByCategory.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import OutcomeStacked from '../components/OutcomeStacked.jsx';
import RunStatusBadge from '../components/RunStatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import StatCard from '../components/StatCard.jsx';
import api from '../services/api.js';

function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function OverallCategoryTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="bg-elevated border border-line rounded-md p-2.5 shadow-xl text-xs font-mono space-y-1">
      <div className="font-semibold text-ink">{label}</div>
      <div className="text-danger">ASR: {Number(row.asr ?? 0).toFixed(1)}%</div>
      <div className="text-muted">
        Succeeded: {row.succeeded ?? 0} / {row.total ?? 0}
      </div>
    </div>
  );
}

function OverallPerCategoryChart({ perCategoryAsr = {} }) {
  const data = Object.keys(perCategoryAsr)
    .sort()
    .map((cat) => ({
      category: cat,
      asr: Number(perCategoryAsr[cat]?.asr ?? 0),
      total: perCategoryAsr[cat]?.total ?? 0,
      succeeded: perCategoryAsr[cat]?.succeeded ?? 0,
    }));

  const hasAnyRuns = data.some((d) => d.total > 0);

  return (
    <Card className="p-5" data-testid="dashboard-category-asr-chart">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Per-Category ASR (All Project Runs)
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Aggregate attack success rate per category across non-error attack runs.
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted">Y-axis: 0–100%</span>
      </div>

      {!hasAnyRuns ? (
        <div className="h-60 flex items-center justify-center bg-base/40 border border-line/60 rounded text-xs text-muted font-mono">
          Run an attack suite to populate per-category ASR metrics.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#263042"
                vertical={false}
              />
              <XAxis
                dataKey="category"
                tick={{
                  fill: '#9CA3AF',
                  fontSize: 12,
                  fontFamily: 'ui-monospace, monospace',
                }}
                axisLine={{ stroke: '#263042' }}
                tickLine={{ stroke: '#263042' }}
              />
              <YAxis
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
              <Tooltip
                content={<OverallCategoryTooltip />}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
              />
              <Bar
                dataKey="asr"
                name="ASR (%)"
                fill="#EF4444"
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

export default function DashboardPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectsError('');
    try {
      const res = await api.get('/projects');
      const list = res.data?.projects || res.data?.items || [];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0].id,
        );
      } else {
        setSelectedProjectId('');
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load projects.';
      setProjectsError(msg);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async (projectId) => {
    if (!projectId) return;
    setLoadingDashboard(true);
    setDashboardError('');
    try {
      const [dashRes, runsRes] = await Promise.all([
        api.get(`/projects/${projectId}/dashboard`),
        api.get(`/projects/${projectId}/runs`, { params: { page: 1, limit: 5 } }),
      ]);
      setDashboard(dashRes.data);
      setRecentRuns(runsRes.data?.items || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load dashboard metrics.';
      setDashboardError(msg);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchDashboardData(selectedProjectId);
    }
  }, [selectedProjectId, fetchDashboardData]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const latestExp = dashboard?.latestExperiment || null;
  const hasExperimentCategoryComparison = Boolean(
    latestExp?.comparison?.perCategory &&
      Object.keys(latestExp.comparison.perCategory).length > 0,
  );

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Security posture, attack success metrics, and recent evaluation runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {projects.length > 1 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="dashboard-project-picker"
                className="text-xs text-muted whitespace-nowrap"
              >
                Project:
              </label>
              <select
                id="dashboard-project-picker"
                aria-label="Select project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-surface border border-line rounded-md px-3 py-1.5 text-xs text-ink font-medium focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedProject ? (
            <Link to={`/projects/${selectedProject.id}/overview`}>
              <Button variant="secondary" size="sm">
                <FolderKanban className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Open {selectedProject.name}
              </Button>
            </Link>
          ) : (
            <Link to="/projects">
              <Button variant="primary" size="sm">
                Manage Projects
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Loading / Error / Empty Projects States */}
      {loadingProjects ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Spinner size="lg" />
          <p className="text-sm text-muted mt-3">Loading projects...</p>
        </div>
      ) : projectsError ? (
        <div className="space-y-3">
          <ErrorBanner message={projectsError} />
          <Button variant="secondary" size="sm" onClick={fetchProjects}>
            Retry
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first RAGShield project, load the demo knowledge base, and run a baseline vs protected experiment to populate your dashboard."
            action={
              <Link to="/projects">
                <Button variant="primary">Create Project</Button>
              </Link>
            }
          />
        </Card>
      ) : (loadingDashboard || !dashboard) && !dashboardError ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Spinner size="lg" />
          <p className="text-sm text-muted mt-3">Loading dashboard metrics...</p>
        </div>
      ) : dashboardError ? (
        <div className="space-y-3">
          <ErrorBanner message={dashboardError} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchDashboardData(selectedProjectId)}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stat Cards Row */}
          <div
            data-testid="dashboard-stat-cards"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <StatCard
              label="Projects"
              value={String(projects.length)}
              subtext={selectedProject ? `Viewing: ${selectedProject.name}` : null}
              tooltip="Total number of RAGShield projects owned by your account."
            />

            <StatCard
              label="Evaluation Runs"
              value={String(dashboard?.totals?.runs ?? 0)}
              subtext={`${dashboard?.totals?.experiments ?? 0} experiments`}
              tooltip="Total baseline and protected test runs executed in this project."
            />

            <StatCard
              label="Attack Results"
              value={String(dashboard?.totals?.attackRuns ?? 0)}
              subtext={`${dashboard?.totals?.documents ?? 0} documents`}
              tooltip="Total adversarial test case executions recorded in this project."
            />

            {/* Latest ASR Baseline -> Protected Card */}
            <div
              className="bg-surface border border-line rounded-lg p-4 flex flex-col justify-between"
              data-testid="latest-asr-card"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-medium text-muted truncate">
                  Latest ASR (Baseline → Protected)
                </span>
                {latestExp && (
                  <Link
                    to={`/experiments/${latestExp.id}`}
                    className="text-[11px] font-mono text-brand hover:text-brand-hover inline-flex items-center gap-0.5 shrink-0"
                  >
                    Compare
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </Link>
                )}
              </div>

              {latestExp ? (
                <div className="space-y-1">
                  <div className="text-lg font-bold font-mono text-ink tracking-tight">
                    {Number(latestExp.baselineAsr ?? 0).toFixed(1)}% →{' '}
                    <span className="text-success">
                      {Number(latestExp.protectedAsr ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  {latestExp.deltaAsr !== null &&
                    latestExp.deltaAsr !== undefined && (
                      <div
                        className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${
                          latestExp.deltaAsr < 0
                            ? 'text-success'
                            : latestExp.deltaAsr > 0
                              ? 'text-danger'
                              : 'text-muted'
                        }`}
                      >
                        {latestExp.deltaAsr < 0 ? (
                          <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : latestExp.deltaAsr > 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : null}
                        {latestExp.deltaAsr > 0 ? '+' : ''}
                        {Number(latestExp.deltaAsr).toFixed(1)}% ASR delta
                      </div>
                    )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-muted">—</div>
                  <div className="text-xs text-muted">
                    No completed experiment yet
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Outcome Distribution Chart */}
          <OutcomeStacked outcomes={dashboard?.outcomeDistribution || {}} />

          {/* Per-Category ASR Chart */}
          {hasExperimentCategoryComparison ? (
            <AsrByCategory
              perCategory={latestExp.comparison.perCategory}
            />
          ) : (
            <OverallPerCategoryChart
              perCategoryAsr={dashboard?.perCategoryAsr || {}}
            />
          )}

          {/* Recent Runs Table */}
          <Card className="p-0 overflow-hidden" data-testid="dashboard-recent-runs">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink">Recent Runs</h2>
                <p className="text-xs text-muted mt-0.5">
                  Latest evaluation runs for {selectedProject?.name}.
                </p>
              </div>
              <Link to={`/projects/${selectedProjectId}/runs`}>
                <Button variant="ghost" size="sm">
                  View all runs
                  <ExternalLink className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
                </Button>
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Play}
                  title="No runs yet"
                  description="Start a baseline run, protected run, or paired experiment from the Runs tab."
                  action={
                    <Link to={`/projects/${selectedProjectId}/runs`}>
                      <Button variant="primary" size="sm">
                        Go to Runs
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-elevated/30 text-[11px] font-mono uppercase tracking-wider text-muted">
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Progress</th>
                      <th className="py-3 px-4 text-right">ASR</th>
                      <th className="py-3 px-4">Started</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-xs">
                    {recentRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="hover:bg-elevated/50 transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <Badge
                            variant={run.mode === 'protected' ? 'brand' : 'muted'}
                            size="xs"
                          >
                            {run.mode === 'protected' ? (
                              <Shield className="w-3 h-3 mr-1" aria-hidden="true" />
                            ) : (
                              <ShieldOff className="w-3 h-3 mr-1" aria-hidden="true" />
                            )}
                            {run.mode}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <RunStatusBadge status={run.status} />
                        </td>
                        <td className="py-3 px-4 font-mono text-muted whitespace-nowrap">
                          {run.progress?.completed ?? 0} / {run.progress?.total ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {run.metrics?.asr?.mean !== undefined ? (
                            <span
                              className={
                                run.metrics.asr.mean > 0
                                  ? 'text-danger font-semibold'
                                  : 'text-success font-semibold'
                              }
                            >
                              {Number(run.metrics.asr.mean).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted whitespace-nowrap">
                          {formatShortDate(run.startedAt || run.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3 font-mono">
                            <Link
                              to={`/runs/${run.id}`}
                              className="text-brand hover:text-brand-hover"
                            >
                              Inspect
                            </Link>
                            {run.experimentId && (
                              <Link
                                to={`/experiments/${run.experimentId}`}
                                className="text-muted hover:text-ink inline-flex items-center gap-0.5"
                                title="View experiment comparison"
                              >
                                <GitCompare className="w-3.5 h-3.5" aria-hidden="true" />
                                Compare
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
