import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import Badge from './Badge.jsx';

export const OUTCOME_CONFIG = {
  attack_succeeded: {
    label: 'Attack succeeded',
    variant: 'danger',
    Icon: ShieldAlert,
  },
  blocked_by_defense: {
    label: 'Blocked',
    variant: 'success',
    Icon: ShieldCheck,
  },
  model_refused_or_safe: {
    label: 'Safe / refused',
    variant: 'info',
    Icon: CheckCircle2,
  },
  benign_answered: {
    label: 'Answered',
    variant: 'muted',
    Icon: CheckCircle2,
  },
  error: {
    label: 'Error',
    variant: 'warning',
    Icon: AlertTriangle,
  },
};

export default function OutcomeBadge({
  outcome,
  size = 'sm',
  className = '',
}) {
  const config = OUTCOME_CONFIG[outcome] || {
    label: outcome || 'Unknown',
    variant: 'muted',
    Icon: HelpCircle,
  };

  const { label, variant, Icon } = config;

  return (
    <Badge variant={variant} size={size} className={className}>
      <Icon className="w-3 h-3 mr-0.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Badge>
  );
}
