import { FolderPlus } from 'lucide-react';

export default function EmptyState({
  icon: Icon = FolderPlus,
  title,
  description,
  action = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-line rounded-lg bg-surface/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-elevated border border-line flex items-center justify-center text-brand mb-4">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
