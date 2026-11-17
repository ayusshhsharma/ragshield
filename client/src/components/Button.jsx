import Spinner from './Spinner.jsx';

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  ...props
}) {
  const variantClasses = {
    primary:
      'bg-brand text-white hover:bg-brand-hover focus:ring-brand border-transparent',
    secondary:
      'bg-elevated text-ink hover:bg-elevated/80 border-line hover:border-muted/50 focus:ring-brand',
    danger:
      'bg-danger text-white hover:bg-danger/90 border-transparent focus:ring-danger',
    ghost:
      'bg-transparent text-muted hover:text-ink hover:bg-elevated border-transparent focus:ring-brand',
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1.5',
    md: 'text-sm px-4 py-2 rounded-md gap-2',
    lg: 'text-base px-5 py-2.5 rounded-lg gap-2.5',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center font-medium border transition-colors select-none',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base',
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Spinner size={size === 'lg' ? 'md' : 'sm'} />}
      {children}
    </button>
  );
}
