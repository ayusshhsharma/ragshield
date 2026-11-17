import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const sz = sizeClasses[size] || sizeClasses.md;

  return (
    <Loader2
      className={`animate-spin text-current shrink-0 ${sz} ${className}`}
      aria-hidden="true"
    />
  );
}
