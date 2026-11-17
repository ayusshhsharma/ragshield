import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export default function CodeBlock({
  code,
  language = '',
  maxHeight = 'max-h-60',
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className={`relative group rounded-md bg-base border border-line overflow-hidden ${className}`}>
      {language && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-elevated/50 border-b border-line text-[11px] font-mono text-muted">
          <span>{language}</span>
          <span className="text-[10px]">{(code || '').length} chars</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-elevated border border-line text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
        aria-label="Copy code"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      <pre
        className={`p-3 text-xs font-mono text-ink leading-relaxed whitespace-pre-wrap break-words overflow-y-auto ${maxHeight}`}
      >
        <code>{code || ''}</code>
      </pre>
    </div>
  );
}
