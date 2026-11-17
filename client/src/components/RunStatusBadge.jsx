import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import Badge from './Badge.jsx';

export default function RunStatusBadge({ status, className = '' }) {
  switch (status) {
    case 'queued':
      return (
        <Badge variant="muted" size="xs" className={className}>
          <Clock className="w-3 h-3 mr-0.5 text-muted" aria-hidden="true" />
          queued
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="brand" size="xs" className={className}>
          <span className="relative flex h-2 w-2 mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
          </span>
          running
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="success" size="xs" className={className}>
          <CheckCircle2 className="w-3 h-3 mr-0.5" aria-hidden="true" />
          completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="danger" size="xs" className={className}>
          <AlertCircle className="w-3 h-3 mr-0.5" aria-hidden="true" />
          failed
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="warning" size="xs" className={className}>
          <Ban className="w-3 h-3 mr-0.5" aria-hidden="true" />
          cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="muted" size="xs" className={className}>
          {status}
        </Badge>
      );
  }
}
