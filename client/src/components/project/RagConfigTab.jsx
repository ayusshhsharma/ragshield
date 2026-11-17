import { RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import api from '../../services/api.js';
import { DEFAULT_RAG_CONFIG } from '../../utils/constants.js';
import Button from '../Button.jsx';
import Card from '../Card.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import Input from '../Input.jsx';
import Spinner from '../Spinner.jsx';

export default function RagConfigTab({ project, onProjectUpdated }) {
  const toast = useToast();

  const [chunkSize, setChunkSize] = useState(DEFAULT_RAG_CONFIG.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(DEFAULT_RAG_CONFIG.chunkOverlap);
  const [topK, setTopK] = useState(DEFAULT_RAG_CONFIG.topK);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_RAG_CONFIG.systemPrompt);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await api.get(`/projects/${project.id}/rag-config`);
      const cfg = res.data.ragConfig || project.ragConfig || DEFAULT_RAG_CONFIG;
      setChunkSize(cfg.chunkSize ?? DEFAULT_RAG_CONFIG.chunkSize);
      setChunkOverlap(cfg.chunkOverlap ?? DEFAULT_RAG_CONFIG.chunkOverlap);
      setTopK(cfg.topK ?? DEFAULT_RAG_CONFIG.topK);
      setSystemPrompt(cfg.systemPrompt ?? DEFAULT_RAG_CONFIG.systemPrompt);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load RAG configuration';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  }, [project.id, project.ragConfig]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleResetToDefault = () => {
    setChunkSize(DEFAULT_RAG_CONFIG.chunkSize);
    setChunkOverlap(DEFAULT_RAG_CONFIG.chunkOverlap);
    setTopK(DEFAULT_RAG_CONFIG.topK);
    setSystemPrompt(DEFAULT_RAG_CONFIG.systemPrompt);
    setErrors({});
    setServerError(null);
    toast.info('Form reset to default RAG parameters.');
  };

  const validate = () => {
    const nextErrors = {};
    const parsedChunkSize = Number(chunkSize);
    const parsedChunkOverlap = Number(chunkOverlap);
    const parsedTopK = Number(topK);

    if (isNaN(parsedChunkSize) || parsedChunkSize < 100 || parsedChunkSize > 2000) {
      nextErrors.chunkSize = 'Chunk size must be between 100 and 2000 characters.';
    }

    if (
      isNaN(parsedChunkOverlap) ||
      parsedChunkOverlap < 0 ||
      parsedChunkOverlap > Math.floor(parsedChunkSize / 2)
    ) {
      nextErrors.chunkOverlap = `Overlap must be between 0 and half the chunk size (${Math.floor(
        parsedChunkSize / 2,
      )}).`;
    }

    if (isNaN(parsedTopK) || parsedTopK < 1 || parsedTopK > 10) {
      nextErrors.topK = 'Top-K retrieved chunks must be between 1 and 10.';
    }

    if (!systemPrompt || !systemPrompt.trim()) {
      nextErrors.systemPrompt = 'System prompt instruction cannot be empty.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(chunkOverlap),
        topK: Number(topK),
        systemPrompt: systemPrompt.trim(),
      };

      const res = await api.put(`/projects/${project.id}/rag-config`, payload);
      toast.success('RAG configuration saved successfully.');

      if (onProjectUpdated) {
        onProjectUpdated({
          ...project,
          ragConfig: res.data.ragConfig,
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save RAG configuration';
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-surface border border-line rounded-lg space-y-2">
        <Spinner size="md" className="text-brand" />
        <p className="text-xs font-mono text-muted">Loading RAG configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">
            RAG Pipeline Parameters
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Configure chunking bounds, vector retrieval top-K, and the active system prompt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleResetToDefault}
            disabled={saving}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset to Default
          </Button>

          <Button
            type="submit"
            form="rag-config-form"
            variant="brand"
            size="sm"
            loading={saving}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Changes
          </Button>
        </div>
      </div>

      {serverError && (
        <ErrorBanner
          message={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      <form id="rag-config-form" onSubmit={handleSave} noValidate className="space-y-6">
        <Card className="space-y-6">
          <h3 className="text-sm font-semibold text-ink border-b border-line pb-3">
            Chunking & Retrieval Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              id="chunk-size"
              label="Chunk Size (characters)"
              type="number"
              min={100}
              max={2000}
              required
              value={chunkSize}
              onChange={(e) => {
                setChunkSize(e.target.value);
                if (errors.chunkSize) setErrors((prev) => ({ ...prev, chunkSize: '' }));
              }}
              error={errors.chunkSize}
              helper="Range: 100 – 2000 chars (default: 500)"
            />

            <Input
              id="chunk-overlap"
              label="Chunk Overlap (characters)"
              type="number"
              min={0}
              max={Math.floor(Number(chunkSize || 500) / 2)}
              required
              value={chunkOverlap}
              onChange={(e) => {
                setChunkOverlap(e.target.value);
                if (errors.chunkOverlap) setErrors((prev) => ({ ...prev, chunkOverlap: '' }));
              }}
              error={errors.chunkOverlap}
              helper={`Max: ${Math.floor(Number(chunkSize || 500) / 2)} chars (0 to chunkSize/2)`}
            />

            <Input
              id="top-k"
              label="Top-K Retrieved Chunks"
              type="number"
              min={1}
              max={10}
              required
              value={topK}
              onChange={(e) => {
                setTopK(e.target.value);
                if (errors.topK) setErrors((prev) => ({ ...prev, topK: '' }));
              }}
              error={errors.topK}
              helper="Range: 1 – 10 chunks (default: 4)"
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="system-prompt"
                className="block text-xs font-medium text-ink"
              >
                System Prompt Instruction
                <span className="text-danger ml-0.5">*</span>
              </label>
              <span className="text-[11px] font-mono text-muted">
                {systemPrompt.length} chars
              </span>
            </div>
            <p className="text-xs text-muted">
              Defines the system identity, domain scope, and security instructions passed to the LLM.
            </p>
          </div>

          <textarea
            id="system-prompt"
            rows={7}
            value={systemPrompt}
            onChange={(e) => {
              setSystemPrompt(e.target.value);
              if (errors.systemPrompt) setErrors((prev) => ({ ...prev, systemPrompt: '' }));
            }}
            placeholder="System prompt text..."
            className={`w-full bg-base border rounded-md font-mono text-xs text-ink placeholder-muted p-3.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface resize-y leading-relaxed ${
              errors.systemPrompt
                ? 'border-danger focus:border-danger focus:ring-danger/40'
                : 'border-line focus:border-brand focus:ring-brand/40'
            }`}
          />

          {errors.systemPrompt && (
            <p className="text-xs text-danger font-mono">{errors.systemPrompt}</p>
          )}

          <div className="p-3 rounded-md bg-elevated/40 border border-line text-[11px] text-muted space-y-1">
            <p className="font-semibold text-ink">Canary & Secret Guidance:</p>
            <p>
              The default prompt includes canary <code className="font-mono text-brand-hover">CANARY-ALPHA-9921</code> to measure direct system prompt leakage in Attack Test Suite AT-01.
            </p>
          </div>
        </Card>
      </form>
    </div>
  );
}
