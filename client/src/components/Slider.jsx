export default function Slider({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  disabled = false,
  helper = '',
  className = '',
}) {
  const numericValue = Number(value ?? 0.5);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-ink">
            {label}
          </label>
        )}
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-base border border-line text-brand-hover font-semibold">
          {numericValue.toFixed(2)}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-2 bg-base rounded-lg appearance-none cursor-pointer accent-brand border border-line focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 focus:ring-offset-surface ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />

      {helper && <p className="text-[11px] text-muted">{helper}</p>}
    </div>
  );
}
