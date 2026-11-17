import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DefensesTab from '../components/project/DefensesTab.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import api from '../services/api.js';

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const mockProject = {
  id: 'proj-def-1',
  name: 'Security Test Workspace',
  defenseConfig: {
    inputScanner: { enabled: false, threshold: 0.5 },
    documentScanner: { enabled: false, threshold: 0.5 },
    instructionIsolation: { enabled: false },
    outputValidator: { enabled: false },
  },
};

function renderWithToast(ui) {
  return render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  );
}

describe('DefensesTab (/projects/:id/defenses)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four defense cards, thresholds, and incomplete defense notice', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        defenseConfig: {
          inputScanner: { enabled: false, threshold: 0.5 },
          documentScanner: { enabled: false, threshold: 0.5 },
          instructionIsolation: { enabled: false },
          outputValidator: { enabled: false },
        },
      },
    });

    renderWithToast(<DefensesTab project={mockProject} />);

    expect(screen.getByText('Loading defense layers...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('DF-01: Input Prompt Scanner')).toBeInTheDocument();
      expect(screen.getByText('DF-02: Retrieved Document Scanner')).toBeInTheDocument();
      expect(screen.getByText('DF-03: Instruction Isolation')).toBeInTheDocument();
      expect(screen.getByText('DF-05: Output Validator')).toBeInTheDocument();
    });

    // Incomplete defense notice
    expect(
      screen.getByText(/Notice: No defense is a complete solution/i),
    ).toBeInTheDocument();

    // 0 of 4 Active badge
    expect(screen.getByText('0 of 4 Active')).toBeInTheDocument();

    // Threshold sliders exist
    expect(screen.getByRole('switch', { name: 'Toggle DF-01 Input Scanner' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle DF-02 Document Scanner' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle DF-03 Instruction Isolation' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle DF-05 Output Validator' })).toBeInTheDocument();
  });

  it('toggles defense layers and updates active count badge', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        defenseConfig: mockProject.defenseConfig,
      },
    });

    renderWithToast(<DefensesTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('0 of 4 Active')).toBeInTheDocument();
    });

    const df01Toggle = screen.getByRole('switch', { name: 'Toggle DF-01 Input Scanner' });
    const df03Toggle = screen.getByRole('switch', { name: 'Toggle DF-03 Instruction Isolation' });

    // Enable DF-01 and DF-03
    fireEvent.click(df01Toggle);
    fireEvent.click(df03Toggle);

    expect(screen.getByText('2 of 4 Active')).toBeInTheDocument();
  });

  it('handles Enable All and Disable All actions', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        defenseConfig: mockProject.defenseConfig,
      },
    });

    renderWithToast(<DefensesTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('0 of 4 Active')).toBeInTheDocument();
    });

    // Click Enable All
    const enableAllBtn = screen.getByRole('button', { name: 'Enable All' });
    fireEvent.click(enableAllBtn);

    expect(screen.getByText('4 of 4 Active')).toBeInTheDocument();

    // Now button text switches to "Disable All"
    const disableAllBtn = screen.getByRole('button', { name: 'Disable All' });
    fireEvent.click(disableAllBtn);

    expect(screen.getByText('0 of 4 Active')).toBeInTheDocument();
  });

  it('updates slider threshold with step 0.05', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        defenseConfig: {
          ...mockProject.defenseConfig,
          inputScanner: { enabled: true, threshold: 0.5 },
        },
      },
    });

    renderWithToast(<DefensesTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('1 of 4 Active')).toBeInTheDocument();
    });

    const slider = screen.getByLabelText('DF-01 Sensitivity Threshold');
    expect(slider).not.toBeDisabled();
    expect(slider).toHaveValue('0.5');

    fireEvent.change(slider, { target: { value: '0.65' } });
    expect(slider).toHaveValue('0.65');
  });

  it('submits updated defenses to PUT /api/projects/:id/defenses and shows toast', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        defenseConfig: mockProject.defenseConfig,
      },
    });

    api.put.mockResolvedValueOnce({
      data: {
        defenseConfig: {
          inputScanner: { enabled: true, threshold: 0.4 },
          documentScanner: { enabled: true, threshold: 0.6 },
          instructionIsolation: { enabled: true },
          outputValidator: { enabled: true },
        },
      },
    });

    const onProjectUpdated = vi.fn();
    renderWithToast(
      <DefensesTab project={mockProject} onProjectUpdated={onProjectUpdated} />,
    );

    await waitFor(() => {
      expect(screen.getByText('0 of 4 Active')).toBeInTheDocument();
    });

    // Enable All
    fireEvent.click(screen.getByRole('button', { name: 'Enable All' }));

    // Change sliders
    const slider1 = screen.getByLabelText('DF-01 Sensitivity Threshold');
    const slider2 = screen.getByLabelText('DF-02 Sensitivity Threshold');
    fireEvent.change(slider1, { target: { value: '0.4' } });
    fireEvent.change(slider2, { target: { value: '0.6' } });

    // Save
    const saveBtn = screen.getByRole('button', { name: /save defenses/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/projects/proj-def-1/defenses', {
        inputScanner: { enabled: true, threshold: 0.4 },
        documentScanner: { enabled: true, threshold: 0.6 },
        instructionIsolation: { enabled: true },
        outputValidator: { enabled: true },
      });
      expect(
        screen.getByText('Defense configuration saved successfully.'),
      ).toBeInTheDocument();
      expect(onProjectUpdated).toHaveBeenCalled();
    });
  });

  it('displays ErrorBanner if saving defenses fails', async () => {
    api.get.mockResolvedValueOnce({
      data: { defenseConfig: mockProject.defenseConfig },
    });

    api.put.mockRejectedValueOnce({
      response: {
        data: {
          error: { message: 'Server rejected defense threshold range' },
        },
      },
    });

    renderWithToast(<DefensesTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('0 of 4 Active')).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /save defenses/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Server rejected defense threshold range'),
      ).toBeInTheDocument();
    });
  });
});
