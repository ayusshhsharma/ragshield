import {
  AlertCircle,
  Code,
  FileCode,
  Info,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import api from '../../services/api.js';
import Badge from '../Badge.jsx';
import Button from '../Button.jsx';
import CodeBlock from '../CodeBlock.jsx';
import ConfirmModal from '../ConfirmModal.jsx';
import Drawer from '../Drawer.jsx';
import EmptyState from '../EmptyState.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import Spinner from '../Spinner.jsx';
import CustomCaseModal from './CustomCaseModal.jsx';

const CATEGORY_CHIPS = [
  { id: 'ALL', label: 'All Cases' },
  { id: 'AT-01', label: 'AT-01 Direct' },
  { id: 'AT-02', label: 'AT-02 Prompt Leak' },
  { id: 'AT-03', label: 'AT-03 Delimiters' },
  { id: 'AT-04', label: 'AT-04 Indirect' },
  { id: 'AT-05', label: 'AT-05 Exfiltration' },
  { id: 'AT-06', label: 'AT-06 Multi-Turn' },
  { id: 'AT-07', label: 'AT-07 Obfuscation' },
  { id: 'AT-08', label: 'AT-08 Hinglish' },
  { id: 'BENIGN', label: 'Benign Q&A' },
  { id: 'CUSTOM', label: 'Custom' },
];

export default function AttackLibraryTab({ project }) {
  const toast = useToast();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Synthetic-data banner dismiss state
  const [showSyntheticBanner, setShowSyntheticBanner] = useState(true);

  // Modals / Drawers
  const [selectedCase, setSelectedCase] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/attacks/library');
      setCases(res.data.cases || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load attack library';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Client-side filtering across categories and search
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Category filter
      if (activeCategory === 'CUSTOM') {
        if (c.source !== 'custom') return false;
      } else if (activeCategory !== 'ALL') {
        if (c.category !== activeCategory) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = c.caseId?.toLowerCase().includes(q);
        const matchName = c.name?.toLowerCase().includes(q);
        const matchDesc = c.description?.toLowerCase().includes(q);
        const matchTech = c.technique?.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchDesc && !matchTech) return false;
      }

      return true;
    });
  }, [cases, activeCategory, searchQuery]);

  // Handle custom case creation
  const handleCreateCustom = async (caseData) => {
    const res = await api.post(`/projects/${project.id}/attacks/custom`, caseData);
    const newCase = res.data.case;
    setCases((prev) => [newCase, ...prev]);
    toast.success(`Custom case ${newCase.caseId} created successfully.`);
  };

  // Handle custom case deletion
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(
        `/projects/${project.id}/attacks/custom/${deleteTarget.caseId}`,
      );
      setCases((prev) => prev.filter((c) => c.caseId !== deleteTarget.caseId));
      if (selectedCase?.caseId === deleteTarget.caseId) {
        setSelectedCase(null);
      }
      setDeleteTarget(null);
      toast.success(`Custom case ${deleteTarget.caseId} deleted.`);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to delete custom attack case';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getSeverityVariant = (sev = '') => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'muted';
      default:
        return 'muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink">
              Prompt-Injection Attack Library
            </h2>
            <Badge variant="brand">{filteredCases.length} Cases</Badge>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Standard OWASP LLM01 benchmark test cases and project-scoped custom attack scenarios.
          </p>
        </div>

        <Button
          type="button"
          variant="brand"
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Custom Case
        </Button>
      </div>

      {/* Dismissible synthetic-data safety banner (docs/design.md §6) */}
      {showSyntheticBanner && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-info/10 border border-info/30 text-xs text-ink">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-info shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-white">Notice:</strong> All secrets, canaries, and customer data in this tool are strictly synthetic.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSyntheticBanner(false)}
            className="p-1 rounded text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Dismiss synthetic data notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <Button
            type="button"
            variant="secondary"
            onClick={fetchLibrary}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by case ID, title, technique, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-line rounded-md pl-9 pr-3 py-2 text-xs text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Category filters">
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = activeCategory === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveCategory(chip.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-surface border border-line text-muted hover:text-ink hover:bg-elevated'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-16 bg-surface border border-line rounded-lg space-y-2">
          <Spinner size="md" className="text-brand" />
          <p className="text-xs font-mono text-muted">Loading attack library...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredCases.length === 0 && (
        <EmptyState
          icon={Shield}
          title="No attack cases found"
          description={
            searchQuery || activeCategory !== 'ALL'
              ? 'No test cases matched your filter criteria. Try clearing the search or category filter.'
              : 'The attack library contains no test cases.'
          }
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveCategory('ALL');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </Button>
          }
        />
      )}

      {/* Cases Table */}
      {!loading && !error && filteredCases.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/60 text-muted border-b border-line uppercase font-mono tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Case ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Attack Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 font-medium">Technique</th>
                  <th scope="col" className="px-4 py-3 font-medium">Severity</th>
                  <th scope="col" className="px-4 py-3 font-medium">Language</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredCases.map((c) => {
                  const isCustom = c.source === 'custom';
                  return (
                    <tr
                      key={c.caseId}
                      onClick={() => setSelectedCase(c)}
                      className="hover:bg-elevated/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-brand-hover">
                        {c.caseId}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink max-w-xs truncate" title={c.name}>
                        {c.name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="muted" size="xs">
                          {c.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted truncate max-w-[140px]">
                        {c.technique}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getSeverityVariant(c.severity)} size="xs">
                          {c.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted uppercase">
                        {c.language}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteError(null);
                              setDeleteTarget(c);
                            }}
                            className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
                            aria-label={`Delete custom case ${c.caseId}`}
                            title="Delete custom case"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Case Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedCase)}
        onClose={() => setSelectedCase(null)}
        title={selectedCase ? `${selectedCase.caseId}: ${selectedCase.name}` : ''}
        subtitle={selectedCase?.owaspRef || selectedCase?.technique}
      >
        {selectedCase && (
          <div className="space-y-5 text-xs">
            {/* Metadata badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{selectedCase.category}</Badge>
              <Badge variant={getSeverityVariant(selectedCase.severity)}>
                {selectedCase.severity}
              </Badge>
              <Badge variant="muted">Lang: {selectedCase.language}</Badge>
              {selectedCase.source === 'custom' && (
                <Badge variant="warning">Custom</Badge>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <h4 className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                Description
              </h4>
              <p className="text-sm text-ink leading-relaxed">
                {selectedCase.description}
              </p>
            </div>

            {/* User Query Prompt */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                User Query (Injection Payload)
              </h4>
              <CodeBlock code={selectedCase.userQuery} language="prompt" />
            </div>

            {/* Injected Chunks (for context poisoning / indirect injection) */}
            {selectedCase.injectedChunks && selectedCase.injectedChunks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                  Injected Reference Context Chunks ({selectedCase.injectedChunks.length})
                </h4>
                {selectedCase.injectedChunks.map((chunk, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-[10px] font-mono text-muted">
                      Position: {chunk.position}
                    </span>
                    <CodeBlock code={chunk.text} language="chunk" />
                  </div>
                ))}
              </div>
            )}

            {/* Expected Behavior */}
            <div className="space-y-1">
              <h4 className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                Expected Safe Behavior
              </h4>
              <p className="text-xs text-muted leading-relaxed">
                {selectedCase.expectedBehavior}
              </p>
            </div>

            {/* Success Condition / Evaluator Matcher */}
            {selectedCase.successCondition && (
              <div className="space-y-1.5 p-3 rounded-lg bg-base border border-line">
                <h4 className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                  Attack Success Condition (ASR Trigger)
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Type:</span>
                  <Badge variant="info" size="xs">
                    {selectedCase.successCondition.type}
                  </Badge>
                  {selectedCase.successCondition.flags && (
                    <span className="font-mono text-muted">
                      flags: /{selectedCase.successCondition.flags}/
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <CodeBlock
                    code={selectedCase.successCondition.values.join('\n')}
                    maxHeight="max-h-24"
                  />
                </div>
              </div>
            )}

            {/* Benign keywords if benign case */}
            {selectedCase.expectedKeywords && selectedCase.expectedKeywords.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                  Expected Benign Keywords
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCase.expectedKeywords.map((kw, i) => (
                    <Badge key={i} variant="muted" size="xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Case Delete Action */}
            {selectedCase.source === 'custom' && (
              <div className="pt-4 border-t border-line flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(selectedCase);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete Custom Case
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* New Custom Case Modal */}
      <CustomCaseModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateCustom}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Custom Attack Case"
        itemName={deleteTarget?.caseId || 'this case'}
        message={`Are you sure you want to delete custom case ${deleteTarget?.caseId} (${deleteTarget?.name})?`}
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
