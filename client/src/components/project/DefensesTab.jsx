import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  FileSearch,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import api from '../../services/api.js';
import Badge from '../Badge.jsx';
import Button from '../Button.jsx';
import Card from '../Card.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import Slider from '../Slider.jsx';
import Spinner from '../Spinner.jsx';
import Toggle from '../Toggle.jsx';

const DEFAULT_DEFENSES = {
  inputScanner: { enabled: false, threshold: 0.5 },
  documentScanner: { enabled: false, threshold: 0.5 },
  instructionIsolation: { enabled: false },
  outputValidator: { enabled: false },
};

export default function DefensesTab({ project, onProjectUpdated }) {
  const toast = useToast();

  const [inputScanner, setInputScanner] = useState(DEFAULT_DEFENSES.inputScanner);
  const [documentScanner, setDocumentScanner] = useState(DEFAULT_DEFENSES.documentScanner);
  const [instructionIsolation, setInstructionIsolation] = useState(
    DEFAULT_DEFENSES.instructionIsolation,
  );
  const [outputValidator, setOutputValidator] = useState(DEFAULT_DEFENSES.outputValidator);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);

  const fetchDefenses = useCallback(async () => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await api.get(`/projects/${project.id}/defenses`);
      const cfg = res.data.defenseConfig || project.defenseConfig || DEFAULT_DEFENSES;
      setInputScanner(cfg.inputScanner || DEFAULT_DEFENSES.inputScanner);
      setDocumentScanner(cfg.documentScanner || DEFAULT_DEFENSES.documentScanner);
      setInstructionIsolation(cfg.instructionIsolation || DEFAULT_DEFENSES.instructionIsolation);
      setOutputValidator(cfg.outputValidator || DEFAULT_DEFENSES.outputValidator);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load defense configuration';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id, project.defenseConfig]);

  useEffect(() => {
    fetchDefenses();
  }, [fetchDefenses]);

  const activeCount = [
    inputScanner.enabled,
    documentScanner.enabled,
    instructionIsolation.enabled,
    outputValidator.enabled,
  ].filter(Boolean).length;

  const handleEnableAll = () => {
    setInputScanner((prev) => ({ ...prev, enabled: true }));
    setDocumentScanner((prev) => ({ ...prev, enabled: true }));
    setInstructionIsolation({ enabled: true });
    setOutputValidator({ enabled: true });
    toast.info('Enabled all defense layers.');
  };

  const handleDisableAll = () => {
    setInputScanner((prev) => ({ ...prev, enabled: false }));
    setDocumentScanner((prev) => ({ ...prev, enabled: false }));
    setInstructionIsolation({ enabled: false });
    setOutputValidator({ enabled: false });
    toast.info('Disabled all defenses (Baseline configuration).');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setServerError(null);
    setSaving(true);

    try {
      const payload = {
        inputScanner: {
          enabled: Boolean(inputScanner.enabled),
          threshold: Number(inputScanner.threshold ?? 0.5),
        },
        documentScanner: {
          enabled: Boolean(documentScanner.enabled),
          threshold: Number(documentScanner.threshold ?? 0.5),
        },
        instructionIsolation: {
          enabled: Boolean(instructionIsolation.enabled),
        },
        outputValidator: {
          enabled: Boolean(outputValidator.enabled),
        },
      };

      const res = await api.put(`/projects/${project.id}/defenses`, payload);
      toast.success('Defense configuration saved successfully.');

      if (onProjectUpdated) {
        onProjectUpdated({
          ...project,
          defenseConfig: res.data.defenseConfig,
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save defense configuration';
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-surface border border-line rounded-lg space-y-2">
        <Spinner size="md" className="text-brand" />
        <p className="text-xs font-mono text-muted">Loading defense layers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-ink">
              Toggleable Defense Layers
            </h2>
            <Badge variant={activeCount > 0 ? 'success' : 'muted'}>
              {activeCount} of 4 Active
            </Badge>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Configure multi-layered security controls to protect the RAG application against prompt-injection attacks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={activeCount === 4 ? handleDisableAll : handleEnableAll}
            disabled={saving}
          >
            {activeCount === 4 ? 'Disable All' : 'Enable All'}
          </Button>

          <Button
            type="button"
            variant="brand"
            size="sm"
            loading={saving}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Defenses
          </Button>
        </div>
      </div>

      {serverError && (
        <ErrorBanner
          message={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      {/* Incomplete defense notice (Design requirement) */}
      <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-3.5">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
            Notice: No defense is a complete solution
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            Heuristic scanners, threshold rules, and structural delimiter isolation significantly reduce Attack Success Rate (ASR), but determined adversaries can discover novel evasions, token-splitting, or multi-lingual bypasses. RAGShield measures empirical residual risk through repeatable baseline vs protected testing.
          </p>
        </div>
      </div>

      {/* Defense Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: DF-01 Input Scanner */}
        <Card className={`space-y-4 transition-colors ${inputScanner.enabled ? 'border-brand/40 bg-surface' : 'bg-surface/60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-md border ${inputScanner.enabled ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-elevated border-line text-muted'}`}>
                <Search className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  DF-01: Input Prompt Scanner
                </h3>
                <span className="text-[11px] font-mono text-muted">
                  Heuristic Pre-Retrieval Filter
                </span>
              </div>
            </div>

            <Toggle
              id="df-01-toggle"
              checked={inputScanner.enabled}
              onChange={(val) => setInputScanner((prev) => ({ ...prev, enabled: val }))}
              aria-label="Toggle DF-01 Input Scanner"
            />
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Scans user queries before retrieval for prompt override attempts, role switching, system prompt disclosure requests, and exfiltration commands in both English and Hinglish.
          </p>

          <div className="pt-2 border-t border-line">
            <Slider
              id="df-01-slider"
              label="DF-01 Sensitivity Threshold"
              value={inputScanner.threshold}
              onChange={(val) => setInputScanner((prev) => ({ ...prev, threshold: val }))}
              disabled={!inputScanner.enabled}
              min={0}
              max={1}
              step={0.05}
              helper="Lower threshold = stricter detection (higher false positives). Default: 0.50"
            />
          </div>
        </Card>

        {/* Card 2: DF-02 Document Scanner */}
        <Card className={`space-y-4 transition-colors ${documentScanner.enabled ? 'border-brand/40 bg-surface' : 'bg-surface/60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-md border ${documentScanner.enabled ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-elevated border-line text-muted'}`}>
                <FileSearch className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  DF-02: Retrieved Document Scanner
                </h3>
                <span className="text-[11px] font-mono text-muted">
                  Context Chunk Filter
                </span>
              </div>
            </div>

            <Toggle
              id="df-02-toggle"
              checked={documentScanner.enabled}
              onChange={(val) => setDocumentScanner((prev) => ({ ...prev, enabled: val }))}
              aria-label="Toggle DF-02 Document Scanner"
            />
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Inspects retrieved context chunks before feeding them to the generation prompt. Blocks indirect prompt injections and second-person imperative overrides concealed inside retrieved knowledge docs.
          </p>

          <div className="pt-2 border-t border-line">
            <Slider
              id="df-02-slider"
              label="DF-02 Sensitivity Threshold"
              value={documentScanner.threshold}
              onChange={(val) => setDocumentScanner((prev) => ({ ...prev, threshold: val }))}
              disabled={!documentScanner.enabled}
              min={0}
              max={1}
              step={0.05}
              helper="Lower threshold = stricter chunk filtering. Default: 0.50"
            />
          </div>
        </Card>

        {/* Card 3: DF-03 Instruction Isolation */}
        <Card className={`space-y-4 transition-colors ${instructionIsolation.enabled ? 'border-brand/40 bg-surface' : 'bg-surface/60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-md border ${instructionIsolation.enabled ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-elevated border-line text-muted'}`}>
                <FileCode className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  DF-03: Instruction Isolation
                </h3>
                <span className="text-[11px] font-mono text-muted">
                  Structural Delimiter Prompt Builder
                </span>
              </div>
            </div>

            <Toggle
              id="df-03-toggle"
              checked={instructionIsolation.enabled}
              onChange={(val) => setInstructionIsolation({ enabled: val })}
              aria-label="Toggle DF-03 Instruction Isolation"
            />
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Wraps retrieved context inside <code className="font-mono text-brand-hover">&lt;untrusted_context&gt;</code> XML delimiters and injects security directives forbidding the model from executing commands found in the context data.
          </p>

          <div className="p-2.5 rounded bg-base/80 border border-line text-[11px] font-mono text-muted">
            <span className="text-brand-hover">Latency impact:</span> 0 ms overhead (prompt structuring).
          </div>
        </Card>

        {/* Card 4: DF-05 Output Validator */}
        <Card className={`space-y-4 transition-colors ${outputValidator.enabled ? 'border-brand/40 bg-surface' : 'bg-surface/60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-md border ${outputValidator.enabled ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-elevated border-line text-muted'}`}>
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  DF-05: Output Validator
                </h3>
                <span className="text-[11px] font-mono text-muted">
                  Post-Generation Exfiltration Interceptor
                </span>
              </div>
            </div>

            <Toggle
              id="df-05-toggle"
              checked={outputValidator.enabled}
              onChange={(val) => setOutputValidator({ enabled: val })}
              aria-label="Toggle DF-05 Output Validator"
            />
          </div>

          <p className="text-xs text-muted leading-relaxed">
            Validates generated responses against the synthetic secret registry, canary code (<code className="font-mono text-brand-hover">CANARY-ALPHA-9921</code>), base64 encoded exfiltration tokens, and system prompt verbatim echoes.
          </p>

          <div className="p-2.5 rounded bg-base/80 border border-line text-[11px] font-mono text-muted">
            <span className="text-danger font-medium">On violation:</span> Replaces leaked answer with safe refusal string.
          </div>
        </Card>
      </div>
    </div>
  );
}
