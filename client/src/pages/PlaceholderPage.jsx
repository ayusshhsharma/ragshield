import { Link, useParams } from 'react-router-dom';

export function PlaceholderPage({ title, description, showAuthLinks = false }) {
  const params = useParams();
  const hasParams = Object.keys(params).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="text-sm text-muted mt-1">{description}</p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-elevated border border-line text-info">
          T0.4 skeleton
        </span>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 space-y-3">
        <p className="text-sm text-ink">
          Dark-first UI tokens active (<code className="font-mono text-brand-hover">base</code>,{' '}
          <code className="font-mono text-brand-hover">surface</code>,{' '}
          <code className="font-mono text-brand-hover">elevated</code>,{' '}
          <code className="font-mono text-brand-hover">line</code>).
        </p>

        {hasParams && (
          <pre className="p-3 rounded-md bg-base border border-line text-xs font-mono text-muted overflow-x-auto">
            {JSON.stringify(params, null, 2)}
          </pre>
        )}

        {showAuthLinks ? (
          <div className="flex items-center gap-3 pt-2">
            <Link
              to="/"
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-medium transition-colors"
            >
              Open Dashboard
            </Link>
            <Link
              to="/register"
              className="text-sm text-muted hover:text-ink underline-offset-4 hover:underline"
            >
              Register
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-danger/15 text-danger">attack_succeeded</span>
            <span className="px-2 py-0.5 rounded bg-success/15 text-success">blocked_by_defense</span>
            <span className="px-2 py-0.5 rounded bg-info/15 text-info">model_refused_or_safe</span>
            <span className="px-2 py-0.5 rounded bg-warning/15 text-warning">error</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-base text-ink flex items-center justify-center p-6">
      <div className="bg-surface border border-line rounded-lg p-6 max-w-md w-full text-center space-y-4">
        <p className="text-xs font-mono text-warning">404 NOT_FOUND</p>
        <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
        <p className="text-sm text-muted">The requested route does not exist.</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-brand hover:bg-brand-hover text-white text-sm font-medium transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
