import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  Play,
  Shield,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import Badge from '../Badge.jsx';
import Button from '../Button.jsx';
import Card from '../Card.jsx';
import ErrorBanner from '../ErrorBanner.jsx';

export default function OverviewTab({
  project,
  documents = [],
  runsCount = 0,
  onRefresh,
}) {
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState(null);

  // 1. Documents ready: at least one document in 'ready' status
  const readyDocuments = documents.filter((d) => d.status === 'ready');
  const documentsReady = readyDocuments.length > 0;

  // 2. Demo KB loaded: project flag
  const demoKbLoaded = Boolean(project.demoKbLoaded);

  // 3. Defenses configured: at least one defense enabled
  const defenseConfig = project.defenseConfig || {};
  const activeDefenses = [
    defenseConfig.inputScanner?.enabled,
    defenseConfig.documentScanner?.enabled,
    defenseConfig.instructionIsolation?.enabled,
    defenseConfig.outputValidator?.enabled,
  ].filter(Boolean).length;
  const defensesConfigured = activeDefenses > 0;

  // 4. Experiment run: at least one run recorded
  const experimentRun = runsCount > 0;

  // Completed steps count
  const completedCount = [
    documentsReady,
    demoKbLoaded,
    defensesConfigured,
    experimentRun,
  ].filter(Boolean).length;

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    setDemoError(null);
    try {
      await api.post(`/projects/${project.id}/documents/demo`);
      if (onRefresh) await onRefresh();
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load demo knowledge base';
      setDemoError(msg);
    } finally {
      setLoadingDemo(false);
    }
  };

  const checklistItems = [
    {
      id: 'documents',
      title: 'Knowledge Base Documents',
      description: documentsReady
        ? `${readyDocuments.length} document(s) processed and indexed in vector storage.`
        : 'Upload domain documents (.txt, .pdf, .docx) to build the retrieval context.',
      isDone: documentsReady,
      icon: FileText,
      action: (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/projects/${project.id}/documents`)}
        >
          {documentsReady ? 'Manage Documents' : 'Upload Documents'}
          <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
        </Button>
      ),
    },
    {
      id: 'demo-kb',
      title: 'Acme Demo Knowledge Base',
      description: demoKbLoaded
        ? 'Synthetic retail corpus loaded (includes secret canary, admin notes, customer data).'
        : 'Load the standard 5-document synthetic retail corpus with seeded canaries and secrets.',
      isDone: demoKbLoaded,
      icon: Database,
      action: demoKbLoaded ? (
        <Badge variant="success">Loaded</Badge>
      ) : (
        <Button
          type="button"
          variant="brand"
          size="sm"
          loading={loadingDemo}
          onClick={handleLoadDemo}
        >
          Load Demo KB
        </Button>
      ),
    },
    {
      id: 'defenses',
      title: 'Security Defenses',
      description: defensesConfigured
        ? `${activeDefenses} of 4 defense layers active (DF-01, DF-02, DF-03, DF-05).`
        : 'Configure toggleable defenses: input scanner, document scanner, prompt isolation, output validator.',
      isDone: defensesConfigured,
      icon: Shield,
      action: (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/projects/${project.id}/defenses`)}
        >
          {defensesConfigured ? 'Edit Defenses' : 'Configure Defenses'}
          <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
        </Button>
      ),
    },
    {
      id: 'experiment',
      title: 'Attack Benchmark & Experiment',
      description: experimentRun
        ? `${runsCount} test run(s) executed against prompt-injection test cases.`
        : 'Run baseline vs protected security suites to measure Attack Success Rate (ASR) reduction.',
      isDone: experimentRun,
      icon: Zap,
      action: (
        <Button
          type="button"
          variant={experimentRun ? 'secondary' : 'brand'}
          size="sm"
          onClick={() => navigate(`/projects/${project.id}/runs`)}
        >
          {experimentRun ? 'View Runs' : 'Run Experiment'}
          <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Metadata Card */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border-line">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Project Overview</h2>
            <Badge variant="brand">Active Workspace</Badge>
          </div>
          <p className="text-xs text-muted max-w-2xl">
            {project.description ||
              'This project contains isolated RAG vector storage, defense settings, test cases, and experiment runs.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="brand"
            onClick={() => navigate(`/projects/${project.id}/runs`)}
          >
            <Play className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Run Experiment
          </Button>
        </div>
      </Card>

      {/* Demo KB Error Banner if loading demo failed */}
      {demoError && (
        <ErrorBanner
          message={demoError}
          onDismiss={() => setDemoError(null)}
        />
      )}

      {/* Setup Checklist */}
      <div className="bg-surface border border-line rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Evaluation Readiness Checklist
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Complete the setup steps to evaluate baseline vs protected prompt-injection defenses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted">
              {completedCount} of 4 ready
            </span>
            <div className="w-24 h-2 bg-base rounded-full overflow-hidden border border-line">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{ width: `${(completedCount / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-line">
          {checklistItems.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.id}
                className="py-4 first:pt-2 last:pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.isDone ? (
                      <CheckCircle2
                        className="w-5 h-5 text-success"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="w-5 h-5 text-muted"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {item.title}
                      </span>
                      {item.isDone ? (
                        <Badge variant="success" size="xs">
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted max-w-xl">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  {item.action}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
