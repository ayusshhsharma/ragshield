import { AlertCircle, AlertTriangle, ArrowRight, Play, Shield, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import Modal from '../Modal.jsx';
import Toggle from '../Toggle.jsx';

const ALL_CATEGORIES = [
  { id: 'AT-01', label: 'AT-01: Direct Prompt Injection' },
  { id: 'AT-02', label: 'AT-02: System Prompt Leakage' },
  { id: 'AT-03', label: 'AT-03: Delimiter Hijacking' },
  { id: 'AT-04', label: 'AT-04: Indirect Context Injection' },
  { id: 'AT-05', label: 'AT-05: Hyperlink / Markdown Exfiltration' },
  { id: 'AT-06', label: 'AT-06: Multi-Turn Jailbreak' },
  { id: 'AT-07', label: 'AT-07: Obfuscation / Encoding' },
  { id: 'AT-08', label: 'AT-08: Multilingual / Hinglish' },
];

export default function RunOptionsModal({
  isOpen,
  mode = 'baseline',
  project,
  onClose,
  onSubmit,
}) {
  const navigate = useNavigate();

  const [selectedCategories, setSelectedCategories] = useState(
    ALL_CATEGORIES.map((c) => c.id),
  );
  const [repeats, setRepeats] = useState(1);
  const [includeBenign, setIncludeBenign] = useState(true);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [actionableNotice, setActionableNotice] = useState(null);

  // Check project defense status
  const defenseConfig = project?.defenseConfig || {};
  const hasActiveDefenses = Boolean(
    defenseConfig.inputScanner?.enabled ||
      defenseConfig.documentScanner?.enabled ||
      instructionIsolationEnabled(defenseConfig) ||
      defenseConfig.outputValidator?.enabled,
  );

  function instructionIsolationEnabled(cfg) {
    return Boolean(cfg?.instructionIsolation?.enabled);
  }

  const isDemoKbMissing = !project?.demoKbLoaded;
  const isProtectedWithoutDefenses =
    (mode === 'protected' || mode === 'experiment') && !hasActiveDefenses;

  const handleCategoryToggle = (catId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  };

  const handleSelectAll = () => {
    setSelectedCategories(ALL_CATEGORIES.map((c) => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedCategories([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    setActionableNotice(null);

    // Client-side category check
    if (selectedCategories.length === 0 && !includeBenign) {
      setServerError('Please select at least one attack category or include benign test cases.');
      return;
    }

    setLoading(true);

    try {
      const options = {
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        repeats: Math.min(5, Math.max(1, Number(repeats) || 1)),
        includeBenign: mode !== 'experiment' ? includeBenign : undefined,
      };

      await onSubmit(mode, options);
      onClose();
    } catch (err) {
      const errCode = err?.response?.data?.error?.code;
      const errMsg = err?.response?.data?.error?.message;

      if (errCode === 'DEMO_KB_REQUIRED') {
        setActionableNotice({
          type: 'demo_kb',
          message:
            errMsg ||
            'Demo knowledge base is required to run evaluation test suites. Please load the demo knowledge base from the Documents tab.',
          actionText: 'Go to Documents Tab',
          actionPath: `/projects/${project.id}/documents`,
        });
      } else if (errCode === 'NO_DEFENSES_ENABLED') {
        setActionableNotice({
          type: 'no_defenses',
          message:
            errMsg ||
            'No defenses are currently enabled. Please enable at least one defense layer in the Defenses tab before starting a protected run.',
          actionText: 'Configure Defenses',
          actionPath: `/projects/${project.id}/defenses`,
        });
      } else {
        setServerError(errMsg || err?.message || 'Failed to start evaluation run.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'baseline':
        return 'Start Baseline Evaluation Run';
      case 'protected':
        return 'Start Protected Evaluation Run';
      case 'experiment':
        return 'Start Benchmark Experiment (Baseline vs Protected)';
      default:
        return 'Start Run';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={getTitle()}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Precondition Warnings */}
        {isDemoKbMissing && (
          <div className="p-3.5 rounded-lg bg-warning/10 border border-warning/30 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-ink">Demo Knowledge Base Required</p>
                <p className="text-muted">
                  Test cases target Acme synthetic documents (canary code, policies, admin records). Load the demo KB before running test suites.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/projects/${project.id}/documents`);
              }}
              className="shrink-0 text-xs py-1"
            >
              Load Demo KB
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}

        {isProtectedWithoutDefenses && (
          <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/30 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-ink">No Defenses Enabled</p>
                <p className="text-muted">
                  Protected runs require at least one active defense layer (DF-01, DF-02, DF-03, DF-05). Enable defenses to measure protection.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/projects/${project.id}/defenses`);
              }}
              className="shrink-0 text-xs py-1"
            >
              Configure
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}

        {/* Actionable Notice if server returns precondition error */}
        {actionableNotice && (
          <div className="p-3.5 rounded-lg bg-warning/10 border border-warning/40 space-y-2 text-xs">
            <p className="text-ink font-medium">{actionableNotice.message}</p>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() => {
                onClose();
                navigate(actionableNotice.actionPath);
              }}
            >
              {actionableNotice.actionText}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}

        {serverError && (
          <ErrorBanner
            message={serverError}
            onDismiss={() => setServerError(null)}
          />
        )}

        {/* Categories Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink">
              Attack Categories ({selectedCategories.length} of {ALL_CATEGORIES.length})
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-brand hover:underline"
              >
                Select All
              </button>
              <span className="text-muted">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-muted hover:underline"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-base border border-line max-h-44 overflow-y-auto">
            {ALL_CATEGORIES.map((cat) => {
              const isChecked = selectedCategories.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 text-xs text-ink cursor-pointer hover:text-white select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleCategoryToggle(cat.id)}
                    className="rounded border-line bg-elevated text-brand focus:ring-brand accent-brand cursor-pointer"
                  />
                  <span className="truncate" title={cat.label}>
                    {cat.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Repeats & Benign Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label htmlFor="run-repeats" className="block text-xs font-semibold text-ink">
              Repeats per Case (1 – 5)
            </label>
            <input
              id="run-repeats"
              type="number"
              min={1}
              max={5}
              value={repeats}
              onChange={(e) => setRepeats(e.target.value)}
              className="w-full bg-base border border-line rounded-md text-xs text-ink px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="text-[11px] text-muted">
              Controls evaluation statistical confidence.
            </p>
          </div>

          {mode !== 'experiment' && (
            <div className="space-y-2 pt-1">
              <span className="block text-xs font-semibold text-ink">
                Benign Test Cases
              </span>
              <Toggle
                id="include-benign-toggle"
                label="Include Benign Questions"
                checked={includeBenign}
                onChange={setIncludeBenign}
              />
              <p className="text-[11px] text-muted">
                Calculates False Positive Rate (FPR) alongside ASR.
              </p>
            </div>
          )}
        </div>

        {/* Mode explanation footer */}
        <div className="p-3 rounded bg-elevated/40 border border-line text-[11px] text-muted leading-relaxed">
          {mode === 'experiment' && (
            <p>
              An <strong>Experiment</strong> executes both a baseline run (all defenses disabled) and a protected run on identical test cases sequentially, computing empirical ASR delta, blocking rate, and defense latency overhead.
            </p>
          )}
          {mode === 'baseline' && (
            <p>
              A <strong>Baseline Run</strong> evaluates raw RAG model vulnerability without active defense layers to establish the reference Attack Success Rate (ASR).
            </p>
          )}
          {mode === 'protected' && (
            <p>
              A <strong>Protected Run</strong> evaluates the RAG system with active project defenses to measure security effectiveness and false-positive overhead.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            loading={loading}
            disabled={isDemoKbMissing || isProtectedWithoutDefenses}
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Launch {mode === 'experiment' ? 'Experiment' : 'Run'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
