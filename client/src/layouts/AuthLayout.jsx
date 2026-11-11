import { Shield } from 'lucide-react';
import { Outlet } from 'react-router-dom';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-base text-ink flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface border border-line">
            <Shield className="w-5 h-5 text-brand" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight text-ink">RAGShield</span>
          </div>
          <p className="text-sm text-muted">Test. Defend. Measure.</p>
        </div>

        <main className="bg-surface border border-line rounded-lg p-6 shadow-xl shadow-black/20">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
