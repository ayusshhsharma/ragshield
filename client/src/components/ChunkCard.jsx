import { FileText, Flame } from 'lucide-react';
import Badge from './Badge.jsx';

export default function ChunkCard({ chunk, index = null, className = '' }) {
  if (!chunk) return null;

  const { source, score, injected, text } = chunk;

  return (
    <div
      data-testid="chunk-card"
      className={`bg-base border ${
        injected ? 'border-danger/50 shadow-sm shadow-danger/10' : 'border-line'
      } rounded-lg p-3.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono text-ink font-medium truncate">
            {source || (index !== null ? `Chunk #${index + 1}` : 'Retrieved chunk')}
          </span>
          {typeof score === 'number' && (
            <span className="text-[11px] font-mono text-muted">
              (score: {score.toFixed(3)})
            </span>
          )}
        </div>

        {injected ? (
          <Badge variant="danger" size="xs">
            <Flame className="w-3 h-3 mr-0.5 text-danger shrink-0" aria-hidden="true" />
            Injected payload
          </Badge>
        ) : (
          <Badge variant="muted" size="xs">
            Context
          </Badge>
        )}
      </div>

      <pre className="text-xs font-mono text-muted bg-surface/60 border border-line/60 rounded p-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
        <code>{text || ''}</code>
      </pre>
    </div>
  );
}
