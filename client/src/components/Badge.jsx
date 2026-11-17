const VARIANT_MAP = {
  success: 'bg-success/15 text-success border-success/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  info: 'bg-info/15 text-info border-info/30',
  brand: 'bg-brand/15 text-brand-hover border-brand/30',
  muted: 'bg-elevated text-muted border-line',
};

export default function Badge({
  children,
  variant = 'muted',
  size = 'sm',
  className = '',
}) {
  const variantClass = VARIANT_MAP[variant] || VARIANT_MAP.muted;
  const sizeClass =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[11px]'
      : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium border rounded ${sizeClass} ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
}
