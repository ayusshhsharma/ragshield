import { FolderKanban, LayoutDashboard, LogOut, Menu, Shield, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-brand',
      isActive
        ? 'bg-elevated text-ink border border-line'
        : 'text-muted hover:text-ink hover:bg-elevated/60',
    ].join(' ');

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 h-14 border-b border-line">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-brand" aria-hidden="true" />
          <span className="font-semibold tracking-tight text-ink">RAGShield</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-md text-muted hover:text-ink hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={navLinkClass}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-line flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">
            {user?.name || 'Developer'}
          </p>
          <p className="text-xs text-muted truncate font-mono">
            {user?.email || 'skeleton session'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-md text-muted hover:text-ink hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-ink flex flex-col md:flex-row">
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-line">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-surface border-b border-line sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-brand" aria-hidden="true" />
          <span className="font-semibold tracking-tight text-ink">RAGShield</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-muted hover:text-ink hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-surface border-r border-line z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:pl-60 min-w-0">
        <main className="max-w-[1200px] mx-auto px-4 py-6 md:px-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
