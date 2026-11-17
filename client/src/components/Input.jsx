export default function Input({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder = '',
  error = '',
  helperText = '',
  required = false,
  disabled = false,
  autoComplete,
  className = '',
  containerClassName = '',
  ...props
}) {
  const inputId = id || name;

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-ink"
        >
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          className={[
            'w-full bg-base border rounded-md text-sm text-ink placeholder-muted px-3 py-2 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/40'
              : 'border-line focus:border-brand focus:ring-brand/40',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>

      {error ? (
        <p
          id={`${inputId}-error`}
          className="text-xs text-danger font-medium flex items-center gap-1"
          role="alert"
        >
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-xs text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
