import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExperimentComparePage from '../pages/ExperimentComparePage.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: mockApi,
    api: mockApi,
  };
});

// Mock Recharts ResponsiveContainer to avoid jsdom 0-width warnings
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 800, height: 300 }} data-testid="recharts-responsive">
        {children}
      </div>
    ),
  };
});

const mockCompletedExperiment = {
  experiment: {
    id: 'exp-1001',
    projectId: 'proj-42',
    status: 'completed',
    baselineRunId: 'run-base-1001',
    protectedRunId: 'run-prot-1001',
    createdAt: '2026-11-17T12:00:00.000Z',
  },
  baselineRun: {
    id: 'run-base-1001',
    mode: 'baseline',
    status: 'completed',
    repeats: 3,
    caseIds: ['AT01-001', 'AT02-001', 'BN-001'],
    llm: { provider: 'mock', model: 'mock-v1', temperature: 0.2 },
    progress: { total: 9, completed: 9, errors: 0 },
    metrics: {
      totals: {
        attackRuns: 6,
        benignRuns: 3,
        errors: 0,
        eligibleAttackRuns: 6,
        eligibleBenignRuns: 3,
      },
      outcomes: {
        attack_succeeded: 5,
        blocked_by_defense: 0,
        model_refused_or_safe: 1,
      },
      asr: { mean: 83.3, min: 75.0, max: 100.0 },
      blockingRate: 0.0,
      safeRate: 16.7,
      detectionRate: 0.0,
      benign: { fpr: 0.0, successRate: 100.0 },
      latency: { avgMs: 220.0, avgAttackMs: 225.0, avgBenignMs: 210.0, avgDefenseMs: 0 },
      perCategory: {
        'AT-01': { runs: 3, asr: 100.0, blockingRate: 0.0, safeRate: 0.0 },
        'AT-02': { runs: 3, asr: 66.7, blockingRate: 0.0, safeRate: 33.3 },
      },
    },
  },
  protectedRun: {
    id: 'run-prot-1001',
    mode: 'protected',
    status: 'completed',
    repeats: 3,
    caseIds: ['AT01-001', 'AT02-001', 'BN-001'],
    llm: { provider: 'mock', model: 'mock-v1', temperature: 0.2 },
    progress: { total: 9, completed: 9, errors: 0 },
    defenseConfigSnapshot: {
      inputScanner: { enabled: true, threshold: 0.5 },
      documentScanner: { enabled: true, threshold: 0.5 },
      instructionIsolation: { enabled: true },
      outputValidator: { enabled: false },
    },
    metrics: {
      totals: {
        attackRuns: 6,
        benignRuns: 3,
        errors: 0,
        eligibleAttackRuns: 6,
        eligibleBenignRuns: 3,
      },
      outcomes: {
        attack_succeeded: 1,
        blocked_by_defense: 4,
        model_refused_or_safe: 1,
      },
      asr: { mean: 16.7, min: 0.0, max: 33.3 },
      blockingRate: 66.7,
      safeRate: 16.6,
      detectionRate: 83.3,
      benign: { fpr: 10.0, successRate: 90.0 },
      latency: { avgMs: 285.5, avgAttackMs: 290.0, avgBenignMs: 270.0, avgDefenseMs: 18.4 },
      perCategory: {
        'AT-01': { runs: 3, asr: 0.0, blockingRate: 100.0, safeRate: 0.0 },
        'AT-02': { runs: 3, asr: 33.3, blockingRate: 33.3, safeRate: 33.4 },
      },
    },
  },
  comparison: {
    asr: { baseline: 83.3, protected: 16.7, delta: -66.6 },
    blockingRate: { baseline: 0.0, protected: 66.7, delta: 66.7 },
    fpr: { baseline: 0.0, protected: 10.0, delta: 10.0 },
    benignSuccessRate: { baseline: 100.0, protected: 90.0, delta: -10.0 },
    avgLatency: { baseline: 220.0, protected: 285.5, delta: 65.5 },
    defenseOverheadMs: 65.5,
    deltaAsr: -66.6,
    deltaBlockingRate: 66.7,
    deltaFpr: 10.0,
    deltaBenignSuccessRate: -10.0,
    perCategory: {
      'AT-01': { baseline: 100.0, protected: 0.0, delta: -100.0 },
      'AT-02': { baseline: 66.7, protected: 33.3, delta: -33.4 },
    },
  },
};

function renderCompare(expId = 'exp-1001') {
  return render(
    <MemoryRouter initialEntries={[`/experiments/${expId}`]}>
      <Routes>
        <Route path="/experiments/:id" element={<ExperimentComparePage />} />
        <Route path="/runs/:id" element={<div>Run Detail Target</div>} />
        <Route path="/projects/:id/runs" element={<div>Project Runs Target</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExperimentComparePage (/experiments/:id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders completed experiment comparison with delta coloring, charts, overhead card, links, and limitations', async () => {
    api.get.mockResolvedValueOnce({ data: mockCompletedExperiment });

    renderCompare();

    await waitFor(() => {
      expect(screen.getByText('Experiment Comparison')).toBeInTheDocument();
    });

    // Links to both runs exist
    const runLinks = screen.getAllByRole('link');
    const hrefs = runLinks.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/runs/run-base-1001');
    expect(hrefs).toContain('/runs/run-prot-1001');

    // Defense overhead card
    const overheadCard = screen.getByTestId('defense-overhead-card');
    expect(overheadCard).toHaveTextContent('+65.5 ms');
    expect(overheadCard).toHaveTextContent('220 ms');
    expect(overheadCard).toHaveTextContent('286 ms');
    expect(overheadCard).toHaveTextContent('18.4 ms');

    // Metric table and delta colors per docs/design.md §2
    const metricTable = screen.getByTestId('experiment-metric-table');
    expect(metricTable).toHaveTextContent('Attack Success Rate (ASR)');
    expect(metricTable).toHaveTextContent('False Positive Rate (FPR)');

    // Lower ASR (-66.60%) -> green (text-success)
    const asrDelta = screen.getByText('-66.60%');
    expect(asrDelta).toHaveClass('text-success');

    // Higher FPR (+10.00%) -> red (text-danger)
    const fprDelta = screen.getByText('+10.00%');
    expect(fprDelta).toHaveClass('text-danger');

    // Higher Blocking Rate (+66.70%) -> green (text-success)
    const blockingDelta = screen.getByText('+66.70%');
    expect(blockingDelta).toHaveClass('text-success');

    // Higher Latency (+66 ms) -> warning (text-warning)
    const latencyDelta = screen.getByText('+66 ms', {
      selector: '[data-testid="delta-badge"]',
    });
    expect(latencyDelta).toHaveClass('text-warning');

    // Charts rendered
    expect(screen.getByTestId('asr-by-category-chart')).toBeInTheDocument();
    expect(screen.getByTestId('outcome-stacked-chart')).toBeInTheDocument();

    // Limitations footnote rendered
    const footnote = screen.getByTestId('limitations-footnote');
    expect(footnote).toHaveTextContent('Evaluation Methodology & Limitations');
    expect(footnote).toHaveTextContent(/synthetic/i);
  });

  it('shows progress bars without charts when experiment runs are still in progress and polls every 2s', async () => {
    const runningExp = {
      experiment: {
        id: 'exp-running',
        projectId: 'proj-42',
        status: 'running',
        baselineRunId: 'run-base-run',
        protectedRunId: 'run-prot-run',
        createdAt: '2026-11-17T12:00:00.000Z',
      },
      baselineRun: {
        id: 'run-base-run',
        mode: 'baseline',
        status: 'running',
        progress: { total: 58, completed: 29, errors: 0 },
        metrics: null,
      },
      protectedRun: {
        id: 'run-prot-run',
        mode: 'protected',
        status: 'queued',
        progress: { total: 58, completed: 0, errors: 0 },
        metrics: null,
      },
      comparison: null,
    };

    api.get.mockResolvedValue({ data: runningExp });

    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderCompare('exp-running');

    await waitFor(() => {
      expect(screen.getByTestId('experiment-in-progress')).toBeInTheDocument();
    });

    expect(screen.getByText('Experiment in progress')).toBeInTheDocument();
    expect(screen.getByTestId('baseline-progress-card')).toHaveTextContent('29 / 58');
    expect(screen.getByTestId('protected-progress-card')).toHaveTextContent('0 / 58');

    // Must NOT render charts or metric table while runs are unfinished
    expect(screen.queryByTestId('asr-by-category-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('outcome-stacked-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('experiment-metric-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('defense-overhead-card')).not.toBeInTheDocument();

    // Polls every 2 s
    await waitFor(() => {
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('shows unavailable notice without charts when an experiment failed', async () => {
    const failedExp = {
      experiment: {
        id: 'exp-failed',
        projectId: 'proj-42',
        status: 'failed',
        baselineRunId: 'run-base-fail',
        protectedRunId: 'run-prot-fail',
      },
      baselineRun: {
        id: 'run-base-fail',
        mode: 'baseline',
        status: 'failed',
        progress: { total: 10, completed: 10, errors: 10 },
        metrics: null,
      },
      protectedRun: {
        id: 'run-prot-fail',
        mode: 'protected',
        status: 'cancelled',
        progress: { total: 10, completed: 0, errors: 0 },
        metrics: null,
      },
      comparison: null,
    };

    api.get.mockResolvedValueOnce({ data: failedExp });

    renderCompare('exp-failed');

    await waitFor(() => {
      expect(screen.getByText('Comparison unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('asr-by-category-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('experiment-metric-table')).not.toBeInTheDocument();
  });

  it('renders error banner and retries on failure', async () => {
    api.get.mockRejectedValueOnce({
      response: { data: { error: { message: 'Experiment not found.' } } },
    });

    renderCompare('exp-missing');

    await waitFor(() => {
      expect(screen.getByText('Experiment not found.')).toBeInTheDocument();
    });

    api.get.mockResolvedValueOnce({ data: mockCompletedExperiment });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByTestId('experiment-results')).toBeInTheDocument();
    });
  });
});
