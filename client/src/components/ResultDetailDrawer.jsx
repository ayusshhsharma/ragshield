import {
  AlertTriangle,
  Clock,
  Info,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import Badge from './Badge.jsx';
import ChunkCard from './ChunkCard.jsx';
import CodeBlock from './CodeBlock.jsx';
import Drawer from './Drawer.jsx';
import OutcomeBadge from './OutcomeBadge.jsx';

export default function ResultDetailDrawer({
  isOpen,
  onClose,
  result,
}) {
  if (!result) return null;

  const {
    caseId,
    category,
    repeatIndex = 1,
    outcome,
    response,
    retrievedChunks = [],
    defensesTriggered = [],
    blocked,
    blockedBy,
    successConditionMatchedRaw,
    ambiguous,
    providerBlocked,
    latencyMs = 0,
    defenseLatencyMs = 0,
    error,
    caseSnapshot = {},
    isBenign,
  } = result;

  const queryText = caseSnapshot.userQuery || '(No query recorded)';
  const expectedText = caseSnapshot.expectedBehavior || '(None specified)';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Case ${caseId}`}
      subtitle={`${category} • ${caseSnapshot.name || (isBenign ? 'Benign Query' : 'Attack Case')} (Repeat #${repeatIndex})`}
      maxWidth="max-w-2xl"
    >
      {/* Status banner */}
      <div className="bg-elevated/70 border border-line rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Outcome:</span>
            <OutcomeBadge outcome={outcome} />
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
              {latencyMs} ms
              {defenseLatencyMs > 0 && ` (${defenseLatencyMs} ms defense)`}
            </span>
          </div>
        </div>

        {blocked && (
          <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/30 rounded p-2">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Request blocked by <strong>{blockedBy || 'active defense'}</strong>.
            </span>
          </div>
        )}

        {ambiguous && (
          <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded p-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Ambiguous:</strong> Output matched the attack success condition but also contained a refusal phrase.
            </span>
          </div>
        )}

        {providerBlocked && (
          <div className="flex items-center gap-2 text-xs text-info bg-info/10 border border-info/30 rounded p-2">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Provider Blocked:</strong> Model provider safety filters suppressed the output.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-danger bg-danger/10 border border-danger/30 rounded p-2 font-mono break-all">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong>Execution error:</strong> {error}
            </div>
          </div>
        )}
      </div>

      {/* Query */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">
            User Query / Prompt
          </label>
          {caseSnapshot.technique && (
            <span className="text-[11px] font-mono text-muted">
              Technique: {caseSnapshot.technique}
            </span>
          )}
        </div>
        <CodeBlock code={queryText} maxHeight="max-h-48" />
      </div>

      {/* Expected behavior & evaluation condition */}
      <div className="bg-elevated/40 border border-line rounded-lg p-3.5 space-y-2">
        <div className="text-xs font-semibold text-ink uppercase tracking-wider">
          Expected Behavior
        </div>
        <p className="text-xs text-muted leading-relaxed">{expectedText}</p>
        {successConditionMatchedRaw !== null && successConditionMatchedRaw !== undefined && (
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono">
            <span className="text-muted">Raw success condition matched:</span>
            <Badge
              variant={successConditionMatchedRaw ? 'danger' : 'success'}
              size="xs"
            >
              {successConditionMatchedRaw ? 'Matched (Injection Succeeded)' : 'Did not match'}
            </Badge>
          </div>
        )}
      </div>

      {/* Retrieved Chunks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">
            Retrieved Context Chunks ({retrievedChunks.length})
          </label>
        </div>
        {retrievedChunks.length === 0 ? (
          <div className="text-xs text-muted font-mono bg-elevated/30 border border-line rounded p-3 text-center">
            No context chunks were retrieved or injected.
          </div>
        ) : (
          <div className="space-y-2.5">
            {retrievedChunks.map((chunk, idx) => (
              <ChunkCard
                key={`${chunk.source || 'chunk'}-${idx}`}
                chunk={chunk}
                index={idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* LLM Response */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">
            Model Response
          </label>
        </div>
        <CodeBlock
          code={response || (blocked ? '[Blocked before generation]' : '(Empty response)')}
          maxHeight="max-h-60"
        />
      </div>

      {/* Defenses Triggered */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">
            Defenses Triggered ({defensesTriggered.length})
          </label>
        </div>
        {defensesTriggered.length === 0 ? (
          <div className="text-xs text-muted font-mono bg-elevated/30 border border-line rounded p-3">
            No defenses fired during this execution.
          </div>
        ) : (
          <div className="space-y-2">
            {defensesTriggered.map((def, idx) => (
              <div
                key={`${def.id || 'def'}-${idx}`}
                className="bg-base border border-line rounded p-3 flex flex-col gap-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-ink">
                    <Shield className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                    <span>{def.id}</span>
                  </div>
                  <Badge variant={def.action === 'blocked' ? 'danger' : 'warning'} size="xs">
                    {def.action || 'triggered'}
                  </Badge>
                </div>
                {def.detail && (
                  <p className="text-muted text-[11px] font-mono mt-0.5">{def.detail}</p>
                )}
                {typeof def.score === 'number' && (
                  <span className="text-[10px] font-mono text-muted">
                    Scan score: {def.score.toFixed(3)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
