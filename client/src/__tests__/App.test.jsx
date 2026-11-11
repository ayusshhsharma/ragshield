import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

function renderAt(route) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Client skeleton & dark theme layouts', () => {
  it('renders AppLayout with dark theme classes and navigation on /', () => {
    const { container } = renderAt('/');

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

  it('renders placeholder workspace route /projects/:id/:tab', () => {
    renderAt('/projects/proj-1/defenses');

    expect(screen.getByRole('heading', { name: 'Project Workspace' })).toBeInTheDocument();
    expect(screen.getByText(/"tab": "defenses"/)).toBeInTheDocument();
  });

  it('renders 404 NotFound page on unknown routes', () => {
    renderAt('/some/unknown/route');

    expect(screen.getByText('404 NOT_FOUND')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/');
  });
});
