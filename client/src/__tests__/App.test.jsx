import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';

function renderAt(route, { user = null, token = null } = {}) {
  return render(
    <AuthProvider initialUser={user} initialToken={token}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>,
  );
}

describe('Client skeleton & dark theme layouts', () => {
  it('redirects unauthenticated user on / to /login', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Test. Defend. Measure.')).toBeInTheDocument();
  });

  it('renders AppLayout with dark theme classes and navigation for authenticated user on /', () => {
    const mockUser = { id: 'u-1', name: 'Dev Lead', email: 'dev@ragshield.local' };
    const { container } = renderAt('/', { user: mockUser, token: 'mock-token' });

    expect(screen.getAllByText('RAGShield').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Projects' }).length).toBeGreaterThan(0);
    expect(container.firstChild).toHaveClass('bg-base', 'text-ink');
  });

  it('renders AuthLayout with tagline on /login', () => {
    const { container } = renderAt('/login');

    expect(screen.getByText('Test. Defend. Measure.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-base', 'text-ink');
  });

  it('renders Projects page on /projects for authenticated user', async () => {
    const mockUser = { id: 'u-1', name: 'Dev Lead', email: 'dev@ragshield.local' };
    renderAt('/projects', { user: mockUser, token: 'mock-token' });

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();
  });

  it('renders 404 NotFound page on unknown routes', () => {
    renderAt('/some/unknown/route');

    expect(screen.getByText('404 NOT_FOUND')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/');
  });
});
