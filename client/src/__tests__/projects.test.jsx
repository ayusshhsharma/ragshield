import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewTab from '../components/project/OverviewTab.jsx';
import ProjectModal from '../components/ProjectModal.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import ProjectShellPage from '../pages/ProjectShellPage.jsx';
import ProjectsPage from '../pages/ProjectsPage.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  getStoredToken: vi.fn(() => 'mock-jwt-token'),
  setStoredToken: vi.fn(),
  clearStoredToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const mockUser = {
  id: 'user-1',
  name: 'Security Engineer',
  email: 'sec@ragshield.local',
};

function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <AuthProvider initialUser={mockUser} initialToken="mock-jwt-token">
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthProvider>,
  );
}

describe('ProjectsPage (/projects)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    api.get.mockReturnValue(new Promise(() => {})); // pending
    renderWithProviders(<ProjectsPage />, { route: '/projects' });

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  it('renders empty state when user has no projects', async () => {
    api.get.mockResolvedValueOnce({ data: { projects: [] } });
    renderWithProviders(<ProjectsPage />, { route: '/projects' });

    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Create your first project workspace/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create project/i }),
    ).toBeInTheDocument();
  });

  it('renders list of project cards when projects exist', async () => {
    const mockProjects = [
      {
        id: 'proj-1',
        name: 'Acme E-Commerce RAG',
        description: 'Customer service assistant testing.',
        demoKbLoaded: true,
        createdAt: '2026-11-17T12:00:00.000Z',
      },
      {
        id: 'proj-2',
        name: 'Internal HR Wiki',
        description: 'Employee policy retriever.',
        demoKbLoaded: false,
        createdAt: '2026-11-17T13:00:00.000Z',
      },
    ];

    api.get.mockResolvedValueOnce({ data: { projects: mockProjects } });
    renderWithProviders(<ProjectsPage />, { route: '/projects' });

    await waitFor(() => {
      expect(screen.getByText('Acme E-Commerce RAG')).toBeInTheDocument();
      expect(screen.getByText('Internal HR Wiki')).toBeInTheDocument();
    });

    expect(screen.getByText('Demo KB Loaded')).toBeInTheDocument();
    expect(screen.getByText('Custom KB')).toBeInTheDocument();
    expect(screen.getAllByText(/Open Workspace/i).length).toBe(2);
  });

  it('renders error banner with retry button on API failure', async () => {
    api.get.mockRejectedValueOnce({
      response: { data: { error: { message: 'Database connection failed' } } },
    });

    renderWithProviders(<ProjectsPage />, { route: '/projects' });

    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('opens New Project modal, validates empty name, and creates project on submit', async () => {
    api.get.mockResolvedValueOnce({ data: { projects: [] } });
    renderWithProviders(<ProjectsPage />, { route: '/projects' });

    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /new project/i }));
    const modal = screen.getByRole('dialog', { name: 'New Project' });
    expect(modal).toBeInTheDocument();

    // Submit with empty name -> inline validation
    const submitBtn = within(modal).getByRole('button', { name: 'Create Project' });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Project name is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    // Type name and description
    const nameInput = within(modal).getByLabelText(/project name/i);
    const descInput = within(modal).getByLabelText(/description/i);

    fireEvent.change(nameInput, { target: { value: 'Finance Bot' } });
    fireEvent.change(descInput, { target: { value: 'Financial reports RAG' } });

    api.post.mockResolvedValueOnce({
      data: {
        project: {
          id: 'proj-new',
          name: 'Finance Bot',
          description: 'Financial reports RAG',
          demoKbLoaded: false,
          createdAt: new Date().toISOString(),
        },
      },
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects', {
        name: 'Finance Bot',
        description: 'Financial reports RAG',
      });
      expect(screen.getByText('Finance Bot')).toBeInTheDocument();
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens delete confirmation modal and removes project on confirm', async () => {
    const mockProjects = [
      {
        id: 'proj-to-delete',
        name: 'Legacy Project',
        description: 'To be deleted',
        demoKbLoaded: false,
        createdAt: '2026-11-17T12:00:00.000Z',
      },
    ];

    api.get.mockResolvedValueOnce({ data: { projects: mockProjects } });
    api.delete.mockResolvedValueOnce({ status: 204 });

    renderWithProviders(<ProjectsPage />, { route: '/projects' });

    await waitFor(() => {
      expect(screen.getByText('Legacy Project')).toBeInTheDocument();
    });

    // Click trash button on card
    const deleteBtn = screen.getByRole('button', {
      name: 'Delete project Legacy Project',
    });
    fireEvent.click(deleteBtn);

    // Verify modal is open and names the item
    const deleteModal = screen.getByRole('dialog', { name: 'Delete Project' });
    expect(deleteModal).toBeInTheDocument();
    expect(within(deleteModal).getByText('Legacy Project')).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = within(deleteModal).getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/projects/proj-to-delete');
      expect(screen.queryByText('Legacy Project')).not.toBeInTheDocument();
      expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });
  });
});

describe('ProjectShellPage & Tab Bar (/projects/:id/:tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProject = {
    id: 'proj-123',
    name: 'Customer Support Bot',
    description: 'RAG system for customer issues',
    demoKbLoaded: false,
    createdAt: '2026-11-17T12:00:00.000Z',
    ragConfig: { chunkSize: 500, chunkOverlap: 80, topK: 4 },
    defenseConfig: {
      inputScanner: { enabled: false, threshold: 0.5 },
      documentScanner: { enabled: false, threshold: 0.5 },
      instructionIsolation: { enabled: false },
      outputValidator: { enabled: false },
    },
  };

  it('renders project header and all 7 tabs defined in design.md', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/projects/proj-123') return Promise.resolve({ data: { project: baseProject } });
      if (url === '/projects/proj-123/documents') return Promise.resolve({ data: { documents: [] } });
      if (url === '/projects/proj-123/runs') return Promise.resolve({ data: { items: [], total: 0 } });
      return Promise.reject(new Error('not found'));
    });

    render(
      <AuthProvider initialUser={mockUser} initialToken="mock-jwt-token">
        <MemoryRouter initialEntries={['/projects/proj-123/overview']}>
          <Routes>
            <Route path="/projects/:id/:tab" element={<ProjectShellPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Customer Support Bot' })).toBeInTheDocument();
    });

    // Check tabs
    const expectedTabs = [
      'Overview',
      'Documents',
      'RAG Config',
      'Defenses',
      'Attack Library',
      'Runs',
      'Playground',
    ];

    expectedTabs.forEach((tabName) => {
      expect(screen.getByRole('tab', { name: tabName })).toBeInTheDocument();
    });
  });

  it('renders "Coming in next task" and no fake data for unbuilt tabs', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/projects/proj-123') return Promise.resolve({ data: { project: baseProject } });
      if (url === '/projects/proj-123/documents') return Promise.resolve({ data: { documents: [] } });
      if (url === '/projects/proj-123/runs') return Promise.resolve({ data: { items: [], total: 0 } });
      return Promise.reject(new Error('not found'));
    });

    render(
      <AuthProvider initialUser={mockUser} initialToken="mock-jwt-token">
        <MemoryRouter initialEntries={['/projects/proj-123/runs']}>
          <Routes>
            <Route path="/projects/:id/:tab" element={<ProjectShellPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Runs — Coming in next task'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/This module will be built in Task T5.6/i),
    ).toBeInTheDocument();
  });
});

describe('OverviewTab Setup Checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays readiness checklist items with pending states when unconfigured', () => {
    const unconfiguredProject = {
      id: 'proj-test',
      name: 'Test Project',
      demoKbLoaded: false,
      defenseConfig: {
        inputScanner: { enabled: false },
        documentScanner: { enabled: false },
        instructionIsolation: { enabled: false },
        outputValidator: { enabled: false },
      },
    };

    render(
      <MemoryRouter>
        <OverviewTab
          project={unconfiguredProject}
          documents={[]}
          runsCount={0}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('0 of 4 ready')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base Documents')).toBeInTheDocument();
    expect(screen.getByText('Acme Demo Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText('Security Defenses')).toBeInTheDocument();
    expect(screen.getByText('Attack Benchmark & Experiment')).toBeInTheDocument();

    // Verify action buttons exist
    expect(screen.getByRole('button', { name: /upload documents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load demo kb/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /configure defenses/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /run experiment/i }).length).toBeGreaterThan(0);
  });

  it('displays ready states when documents, demo KB, defenses, and runs are present', () => {
    const configuredProject = {
      id: 'proj-test-2',
      name: 'Configured Project',
      demoKbLoaded: true,
      defenseConfig: {
        inputScanner: { enabled: true, threshold: 0.5 },
        documentScanner: { enabled: false },
        instructionIsolation: { enabled: true },
        outputValidator: { enabled: false },
      },
    };

    const documents = [{ id: 'doc-1', status: 'ready', filename: 'faq.txt' }];

    render(
      <MemoryRouter>
        <OverviewTab
          project={configuredProject}
          documents={documents}
          runsCount={2}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('4 of 4 ready')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 defense layers active (DF-01, DF-02, DF-03, DF-05).')).toBeInTheDocument();
    expect(screen.getByText('2 test run(s) executed against prompt-injection test cases.')).toBeInTheDocument();
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });

  it('triggers POST /projects/:id/documents/demo when clicking Load Demo KB', async () => {
    const onRefresh = vi.fn();
    const project = {
      id: 'proj-demo',
      demoKbLoaded: false,
      defenseConfig: {},
    };

    api.post.mockResolvedValueOnce({
      data: { documents: [{ id: 'd-1', isDemo: true }] },
    });

    render(
      <MemoryRouter>
        <OverviewTab
          project={project}
          documents={[]}
          runsCount={0}
          onRefresh={onRefresh}
        />
      </MemoryRouter>,
    );

    const loadBtn = screen.getByRole('button', { name: /load demo kb/i });
    fireEvent.click(loadBtn);

    expect(api.post).toHaveBeenCalledWith('/projects/proj-demo/documents/demo');
    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
