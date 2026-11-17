import {
  ArrowLeft,
  Calendar,
  Database,
  FileCode,
  FileText,
  FolderKanban,
  Play,
  Shield,
  Sliders,
  Terminal,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import AttackLibraryTab from '../components/project/AttackLibraryTab.jsx';
import DefensesTab from '../components/project/DefensesTab.jsx';
import DocumentsTab from '../components/project/DocumentsTab.jsx';
import OverviewTab from '../components/project/OverviewTab.jsx';
import PlaygroundTab from '../components/project/PlaygroundTab.jsx';
import RagConfigTab from '../components/project/RagConfigTab.jsx';
import RunsTab from '../components/project/RunsTab.jsx';
import Spinner from '../components/Spinner.jsx';
import api from '../services/api.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FolderKanban, task: 'T5.2' },
  { id: 'documents', label: 'Documents', icon: FileText, task: 'T5.3' },
  { id: 'rag-config', label: 'RAG Config', icon: Sliders, task: 'T5.3' },
  { id: 'defenses', label: 'Defenses', icon: Shield, task: 'T5.4' },
  { id: 'attacks', label: 'Attack Library', icon: FileCode, task: 'T5.5' },
  { id: 'runs', label: 'Runs', icon: Zap, task: 'T5.6' },
  { id: 'playground', label: 'Playground', icon: Terminal, task: 'T5.9' },
];

export default function ProjectShellPage() {
  const { id, tab = 'overview' } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [runsCount, setRunsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjectData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, docsRes, runsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/documents`).catch(() => ({ data: { documents: [] } })),
        api.get(`/projects/${id}/runs`).catch(() => ({ data: { items: [], total: 0 } })),
      ]);

      setProject(projRes.data.project);
      setDocuments(docsRes.data.documents || []);
      setRunsCount(runsRes.data.total ?? runsRes.data.items?.length ?? 0);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load project';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Validate active tab or redirect
  const currentTab = TABS.find((t) => t.id === tab);
  useEffect(() => {
    if (!loading && !currentTab) {
      navigate(`/projects/${id}/overview`, { replace: true });
    }
  }, [loading, currentTab, id, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-3 bg-surface border border-line rounded-lg">
        <Spinner size="lg" className="text-brand" />
        <p className="text-xs font-mono text-muted">Loading workspace...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || 'Project not found.'} />
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-hover"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </Link>
      </div>
    );
  }

  const formattedDate = project.createdAt
    ? new Date(project.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link
            to="/projects"
            className="hover:text-ink transition-colors flex items-center gap-1"
          >
            <FolderKanban className="w-3.5 h-3.5" />
            Projects
          </Link>
          <span>/</span>
          <span className="font-mono text-ink truncate max-w-xs">{project.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted">
              <span className="font-mono">ID: {project.id}</span>
              {formattedDate && (
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </span>
              )}
              {project.demoKbLoaded ? (
                <Badge variant="success" size="xs">
                  <Database className="w-3 h-3 mr-0.5" />
                  Demo KB
                </Badge>
              ) : (
                <Badge variant="muted" size="xs">
                  <Database className="w-3 h-3 mr-0.5" />
                  Custom KB
                </Badge>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={() => navigate(`/projects/${project.id}/runs`)}
            className="self-start sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Run Experiment
          </Button>
        </div>
      </div>

      {/* Tab Bar navigation */}
      <div className="border-b border-line overflow-x-auto">
        <nav
          className="flex space-x-6 min-w-max"
          role="tablist"
          aria-label="Project tabs"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === tab;
            return (
              <NavLink
                key={t.id}
                to={`/projects/${project.id}/${t.id}`}
                role="tab"
                aria-selected={isActive}
                className={`flex items-center gap-2 py-3 text-sm border-b-2 font-medium transition-colors focus:outline-none ${
                  isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-ink hover:border-line'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {tab === 'overview' && (
          <OverviewTab
            project={project}
            documents={documents}
            runsCount={runsCount}
            onRefresh={fetchProjectData}
          />
        )}

        {tab === 'documents' && (
          <DocumentsTab
            project={project}
            onProjectUpdated={fetchProjectData}
          />
        )}

        {tab === 'rag-config' && (
          <RagConfigTab
            project={project}
            onProjectUpdated={fetchProjectData}
          />
        )}

        {tab === 'defenses' && (
          <DefensesTab
            project={project}
            onProjectUpdated={fetchProjectData}
          />
        )}

        {tab === 'attacks' && (
          <AttackLibraryTab
            project={project}
          />
        )}

        {tab === 'runs' && (
          <RunsTab
            project={project}
          />
        )}

        {tab === 'playground' && (
          <PlaygroundTab
            project={project}
            documentsCount={documents.length}
          />
        )}

        {tab !== 'overview' &&
          tab !== 'documents' &&
          tab !== 'rag-config' &&
          tab !== 'defenses' &&
          tab !== 'attacks' &&
          tab !== 'runs' &&
          tab !== 'playground' && (
            <Card className="flex flex-col items-center justify-center p-12 text-center space-y-3 bg-surface/60 border-dashed border-line">
              <div className="w-10 h-10 rounded-full bg-elevated border border-line flex items-center justify-center text-muted">
                {currentTab?.icon && <currentTab.icon className="w-5 h-5" />}
              </div>
              <h3 className="text-base font-semibold text-ink">
                {currentTab?.label || 'Tab'} — Coming in next task
              </h3>
              <p className="text-xs text-muted max-w-md">
                This module will be built in Task {currentTab?.task}. Live data and controls will be wired in accordance with the Phase 5 plan.
              </p>
            </Card>
          )}
      </div>
    </div>
  );
}
