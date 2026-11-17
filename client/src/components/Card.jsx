export default function Card({
  children,
  className = '',
  onClick = null,
  role = undefined,
  ...props
}) {
  return (
    <div
      role={role}
      onClick={onClick}
      className={`bg-surface border border-line rounded-lg p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
