import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RunsTab from '../components/project/RunsTab.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockProjectReady = {
  id: 'proj-run-1',
  name: 'Evaluation Workspace',
  demoKbLoaded: true,
  defenseConfig: {
    inputScanner: { enabled: true, threshold: 0.5 },
    documentScanner: { enabled: false },
    instructionIsolation: { enabled: true },
    outputValidator: { enabled: false },
  },
};

const mockProjectUnready = {
  id: 'proj-run-2',
  name: 'Unconfigured Workspace',
  demoKbLoaded: false,
  defenseConfig: {
    inputScanner: { enabled: false },
    documentScanner: { enabled: false },
    instructionIsolation: { enabled: false },
    outputValidator: { enabled: false },
  },
};

const mockRuns = [
  {
    id: 'run-base-12345678',
    mode: 'baseline',
    status: 'completed',
    experimentId: 'exp-999',
    progress: { total: 58, completed: 58, errors: 0 },
    metrics: {
      attackSuccessRate: 0.724,
      falsePositiveRate: 0.05,
      blockingRate: 0.0,
      totalCases: 58,
    },
    createdAt: '2026-11-17T14:00:00.000Z',
  },
  {
    id: 'run-prot-87654321',
    mode: 'protected',
    status: 'running',
    experimentId: 'exp-999',
    progress: { total: 58, completed: 32, errors: 0 },
    metrics: null,
    createdAt: '2026-11-17T14:05:00.000Z',
  },
];

function renderWithToast(ui) {
  return render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  );
}

describe('RunsTab (/projects/:id/runs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then empty state when no runs exist', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });

    renderWithToast(<RunsTab project={mockProjectReady} />);

    expect(screen.getByText('Loading test runs...')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('No evaluation runs executed yet'),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: /run baseline/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /run experiment/i }).length).toBeGreaterThan(0);
  });

  it('renders table of runs with status badges, progress bars, and comparison links', async () => {
    api.get.mockResolvedValueOnce({ data: { items: mockRuns, total: 2 } });

    renderWithToast(<RunsTab project={mockProjectReady} />);

    await waitFor(() => {
      expect(screen.getByText('run-base-1...')).toBeInTheDocument();
      expect(screen.getByText('run-prot-8...')).toBeInTheDocument();
    });

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('72.4%')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();

    // Link to experiment compare
    const compareLinks = screen.getAllByRole('link', { name: /compare/i });
    expect(compareLinks.length).toBeGreaterThan(0);
    expect(compareLinks[0]).toHaveAttribute('href', '/experiments/exp-999');

    // Details links
    const detailLinks = screen.getAllByRole('link', { name: /details/i });
    expect(detailLinks[0]).toHaveAttribute('href', '/runs/run-base-12345678');
  });

  it('displays precondition warnings in modal when Demo KB is not loaded', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });

    renderWithToast(<RunsTab project={mockProjectUnready} />);

    await waitFor(() => {
      expect(
        screen.getByText('No evaluation runs executed yet'),
      ).toBeInTheDocument();
    });

    // Click Run Baseline
    const baselineBtn = screen.getAllByRole('button', { name: /run baseline/i })[0];
    fireEvent.click(baselineBtn);

    const modal = screen.getByRole('dialog', { name: 'Start Baseline Evaluation Run' });
    expect(modal).toBeInTheDocument();

    // Warning banner for missing demo KB
    expect(
      within(modal).getByText(/Demo Knowledge Base Required/i),
    ).toBeInTheDocument();
    expect(
      within(modal).getByRole('button', { name: /load demo kb/i }),
    ).toBeInTheDocument();

    // Launch button disabled
    const launchBtn = within(modal).getByRole('button', { name: /launch run/i });
    expect(launchBtn).toBeDisabled();
  });

  it('displays precondition warnings in modal when running protected without active defenses', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });

    // Project with demo KB loaded but NO defenses
    const projectNoDefenses = {
      ...mockProjectUnready,
      demoKbLoaded: true,
    };

    renderWithToast(<RunsTab project={projectNoDefenses} />);

    await waitFor(() => {
      expect(screen.getByText('No evaluation runs executed yet')).toBeInTheDocument();
    });

    // Click Run Protected
    const protectedBtn = screen.getByRole('button', { name: 'Run Protected' });
    fireEvent.click(protectedBtn);

    const modal = screen.getByRole('dialog', { name: 'Start Protected Evaluation Run' });
    expect(modal).toBeInTheDocument();

    // Warning banner for missing defenses
    expect(
      within(modal).getByText(/No Defenses Enabled/i),
    ).toBeInTheDocument();
    expect(
      within(modal).getByRole('button', { name: /configure/i }),
    ).toBeInTheDocument();

    // Launch button disabled
    const launchBtn = within(modal).getByRole('button', { name: /launch run/i });
    expect(launchBtn).toBeDisabled();
  });

  it('handles server precondition error (409 DEMO_KB_REQUIRED) with actionable navigation message', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });

    api.post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          error: {
            code: 'DEMO_KB_REQUIRED',
            message: 'Project demo knowledge base must be loaded first.',
          },
        },
      },
    });

    renderWithToast(<RunsTab project={mockProjectReady} />);

    await waitFor(() => {
      expect(screen.getByText('No evaluation runs executed yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /run baseline/i })[0]);
    const modal = screen.getByRole('dialog', { name: 'Start Baseline Evaluation Run' });

    // Submit
    fireEvent.click(within(modal).getByRole('button', { name: /launch run/i }));

    await waitFor(() => {
      expect(
        within(modal).getByText('Project demo knowledge base must be loaded first.'),
      ).toBeInTheDocument();
      expect(
        within(modal).getByRole('button', { name: /go to documents tab/i }),
      ).toBeInTheDocument();
    });
  });

  it('launches baseline run and submits POST /api/projects/:id/runs', async () => {
    api.get
      .mockResolvedValueOnce({ data: { items: [], total: 0 } })
      .mockResolvedValueOnce({
        data: {
          items: [{ ...mockRuns[1], mode: 'baseline', status: 'queued' }],
          total: 1,
        },
      });

    api.post.mockResolvedValueOnce({ data: { runId: 'run-new-123' } });

    renderWithToast(<RunsTab project={mockProjectReady} />);

    await waitFor(() => {
      expect(screen.getByText('No evaluation runs executed yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /run baseline/i })[0]);
    const modal = screen.getByRole('dialog', { name: 'Start Baseline Evaluation Run' });

    // Change repeats
    const repeatsInput = within(modal).getByLabelText(/repeats per case/i);
    fireEvent.change(repeatsInput, { target: { value: '2' } });

    // Launch
    fireEvent.click(within(modal).getByRole('button', { name: /launch run/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects/proj-run-1/runs', {
        mode: 'baseline',
        categories: expect.arrayContaining(['AT-01', 'AT-02']),
        repeats: 2,
        includeBenign: true,
      });
      expect(screen.getByText('Baseline run queued.')).toBeInTheDocument();
    });
  });

  it('launches experiment and submits POST /api/projects/:id/experiments', async () => {
    api.get
      .mockResolvedValueOnce({ data: { items: [], total: 0 } })
      .mockResolvedValueOnce({
        data: { items: mockRuns, total: 2 },
      });

    api.post.mockResolvedValueOnce({
      data: {
        experimentId: 'exp-new-1',
        baselineRunId: 'r-1',
        protectedRunId: 'r-2',
      },
    });

    renderWithToast(<RunsTab project={mockProjectReady} />);

    await waitFor(() => {
      expect(screen.getByText('No evaluation runs executed yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /run experiment/i })[0]);
    const modal = screen.getByRole('dialog', {
      name: 'Start Benchmark Experiment (Baseline vs Protected)',
    });

    // Launch experiment
    fireEvent.click(within(modal).getByRole('button', { name: /launch experiment/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects/proj-run-1/experiments', {
        categories: expect.any(Array),
        repeats: 1,
        includeBenign: undefined,
      });
      expect(
        screen.getByText('Comparative experiment launched.'),
      ).toBeInTheDocument();
    });
  });

  it('polls every 2 s while run is queued or running, and clears interval on unmount', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // Run list contains a running run
    api.get.mockResolvedValueOnce({ data: { items: [mockRuns[1]], total: 1 } });

    const { unmount } = renderWithToast(<RunsTab project={mockProjectReady} />);

    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });

    // Verify setInterval was called with 2000 ms
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

    // Unmount
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
