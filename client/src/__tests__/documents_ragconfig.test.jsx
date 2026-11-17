import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DocumentsTab from '../components/project/DocumentsTab.jsx';
import RagConfigTab from '../components/project/RagConfigTab.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import api from '../services/api.js';
import { DEFAULT_RAG_CONFIG, DEFAULT_SYSTEM_PROMPT } from '../utils/constants.js';

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockProject = {
  id: 'proj-123',
  name: 'Acme Test Project',
  demoKbLoaded: false,
  ragConfig: {
    chunkSize: 500,
    chunkOverlap: 80,
    topK: 4,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
};

function renderWithToast(ui) {
  return render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  );
}

describe('DocumentsTab (/projects/:id/documents)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state then empty state when project has no documents', async () => {
    api.get.mockResolvedValueOnce({ data: { documents: [] } });

    renderWithToast(<DocumentsTab project={mockProject} />);

    expect(screen.getByText('Loading documents...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No documents in knowledge base')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load demo knowledge base/i })).toBeInTheDocument();
  });

  it('renders table of documents with status badges and details', async () => {
    const docs = [
      {
        id: 'doc-1',
        filename: 'refund_policy.txt',
        fileType: '.txt',
        charCount: 4200,
        chunkCount: 9,
        status: 'ready',
        isDemo: true,
        createdAt: '2026-11-17T12:00:00.000Z',
      },
      {
        id: 'doc-2',
        filename: 'unsupported_spec.pdf',
        fileType: '.pdf',
        charCount: null,
        chunkCount: null,
        status: 'failed',
        error: 'PyMuPDF extraction failed',
        isDemo: false,
        createdAt: '2026-11-17T13:00:00.000Z',
      },
    ];

    api.get.mockResolvedValueOnce({ data: { documents: docs } });
    renderWithToast(<DocumentsTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('refund_policy.txt')).toBeInTheDocument();
      expect(screen.getByText('unsupported_spec.pdf')).toBeInTheDocument();
    });

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('validates file extension and rejects unsupported formats client-side', async () => {
    api.get.mockResolvedValueOnce({ data: { documents: [] } });
    renderWithToast(<DocumentsTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('No documents in knowledge base')).toBeInTheDocument();
    });

    const dropzone = screen.getByLabelText('Upload document dropzone');
    const input = dropzone.querySelector('input[type="file"]');

    const fakeExe = new File(['binary content'], 'virus.exe', { type: 'application/x-msdownload' });
    fireEvent.change(input, { target: { files: [fakeExe] } });

    await waitFor(() => {
      expect(screen.getByText(/File type "\.exe" not supported/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('validates file size and rejects files larger than 5 MB client-side', async () => {
    api.get.mockResolvedValueOnce({ data: { documents: [] } });
    renderWithToast(<DocumentsTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('No documents in knowledge base')).toBeInTheDocument();
    });

    const dropzone = screen.getByLabelText('Upload document dropzone');
    const input = dropzone.querySelector('input[type="file"]');

    // Create 6 MB mock file
    const largeBlob = new Blob([new Uint8Array(6 * 1024 * 1024)]);
    const largeFile = new File([largeBlob], 'large_document.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('File exceeds maximum allowed size of 5 MB.')).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('uploads valid document and appends it to table', async () => {
    api.get.mockResolvedValueOnce({ data: { documents: [] } });
    renderWithToast(<DocumentsTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('No documents in knowledge base')).toBeInTheDocument();
    });

    const dropzone = screen.getByLabelText('Upload document dropzone');
    const input = dropzone.querySelector('input[type="file"]');

    const validFile = new File(['Hello Acme Knowledge'], 'faq.txt', { type: 'text/plain' });

    api.post.mockResolvedValueOnce({
      data: {
        document: {
          id: 'doc-uploaded',
          filename: 'faq.txt',
          fileType: '.txt',
          charCount: 20,
          chunkCount: 1,
          status: 'ready',
          isDemo: false,
          createdAt: new Date().toISOString(),
        },
      },
    });

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/projects/proj-123/documents',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
      expect(screen.getByText('faq.txt')).toBeInTheDocument();
    });
  });

  it('calls POST /documents/demo when clicking Load Demo KB', async () => {
    api.get.mockResolvedValueOnce({ data: { documents: [] } });
    const onProjectUpdated = vi.fn();

    renderWithToast(
      <DocumentsTab project={mockProject} onProjectUpdated={onProjectUpdated} />,
    );

    await waitFor(() => {
      expect(screen.getByText('No documents in knowledge base')).toBeInTheDocument();
    });

    api.post.mockResolvedValueOnce({
      data: {
        documents: [
          {
            id: 'doc-demo-1',
            filename: 'refund_policy.txt',
            fileType: '.txt',
            charCount: 3000,
            chunkCount: 6,
            status: 'ready',
            isDemo: true,
          },
        ],
      },
    });

    const demoBtn = screen.getByRole('button', { name: /load demo knowledge base/i });
    fireEvent.click(demoBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects/proj-123/documents/demo');
      expect(screen.getByText('refund_policy.txt')).toBeInTheDocument();
      expect(onProjectUpdated).toHaveBeenCalled();
    });
  });

  it('polls every 2 s while document status is processing and stops on ready or unmount', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const processingDoc = {
      id: 'doc-proc',
      filename: 'large_manual.pdf',
      status: 'processing',
    };

    api.get.mockResolvedValueOnce({ data: { documents: [processingDoc] } });

    const { unmount } = renderWithToast(<DocumentsTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('processing')).toBeInTheDocument();
    });

    // Verify setInterval was called with 2000 ms
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

    // Unmount and verify clearInterval was called
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('confirms document deletion and calls DELETE /documents/:docId', async () => {
    const doc = {
      id: 'doc-del-1',
      filename: 'obsolete.txt',
      fileType: '.txt',
      status: 'ready',
    };

    api.get.mockResolvedValueOnce({ data: { documents: [doc] } });
    api.delete.mockResolvedValueOnce({ status: 204 });

    renderWithToast(<DocumentsTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByText('obsolete.txt')).toBeInTheDocument();
    });

    // Click delete icon
    const delBtn = screen.getByRole('button', { name: 'Delete document obsolete.txt' });
    fireEvent.click(delBtn);

    const dialog = screen.getByRole('dialog', { name: 'Delete Document' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('obsolete.txt')).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/projects/proj-123/documents/doc-del-1');
      expect(screen.queryByText('obsolete.txt')).not.toBeInTheDocument();
      expect(screen.getByText('No documents in knowledge base')).toBeInTheDocument();
    });
  });
});

describe('RagConfigTab (/projects/:id/rag-config)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders config fields with initial values', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ragConfig: {
          chunkSize: 600,
          chunkOverlap: 100,
          topK: 5,
          systemPrompt: 'Custom prompt instruction CANARY-ALPHA-9921',
        },
      },
    });

    renderWithToast(<RagConfigTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/chunk size/i)).toHaveValue(600);
      expect(screen.getByLabelText(/chunk overlap/i)).toHaveValue(100);
      expect(screen.getByLabelText(/top-k/i)).toHaveValue(5);
      expect(screen.getByLabelText(/system prompt/i)).toHaveValue(
        'Custom prompt instruction CANARY-ALPHA-9921',
      );
    });
  });

  it('validates bounds on submit: chunkSize, chunkOverlap <= chunkSize/2, topK, systemPrompt', async () => {
    api.get.mockResolvedValueOnce({ data: { ragConfig: mockProject.ragConfig } });
    renderWithToast(<RagConfigTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/chunk size/i)).toBeInTheDocument();
    });

    const chunkSizeInput = screen.getByLabelText(/chunk size/i);
    const chunkOverlapInput = screen.getByLabelText(/chunk overlap/i);
    const topKInput = screen.getByLabelText(/top-k/i);
    const systemPromptInput = screen.getByLabelText(/system prompt/i);
    const saveBtn = screen.getByRole('button', { name: /save changes/i });

    // Invalid: chunk size out of range, overlap > chunkSize/2, topK > 10, empty prompt
    fireEvent.change(chunkSizeInput, { target: { value: '50' } }); // < 100
    fireEvent.change(chunkOverlapInput, { target: { value: '40' } }); // > 50/2 = 25
    fireEvent.change(topKInput, { target: { value: '15' } }); // > 10
    fireEvent.change(systemPromptInput, { target: { value: '' } });

    fireEvent.click(saveBtn);

    expect(
      screen.getByText('Chunk size must be between 100 and 2000 characters.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Overlap must be between 0 and half the chunk size/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Top-K retrieved chunks must be between 1 and 10.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('System prompt instruction cannot be empty.'),
    ).toBeInTheDocument();

    expect(api.put).not.toHaveBeenCalled();
  });

  it('resets form values to standard defaults when clicking Reset to Default', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ragConfig: {
          chunkSize: 1200,
          chunkOverlap: 200,
          topK: 8,
          systemPrompt: 'Modified system prompt',
        },
      },
    });

    renderWithToast(<RagConfigTab project={mockProject} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/chunk size/i)).toHaveValue(1200);
    });

    const resetBtn = screen.getByRole('button', { name: /reset to default/i });
    fireEvent.click(resetBtn);

    expect(screen.getByLabelText(/chunk size/i)).toHaveValue(DEFAULT_RAG_CONFIG.chunkSize);
    expect(screen.getByLabelText(/chunk overlap/i)).toHaveValue(DEFAULT_RAG_CONFIG.chunkOverlap);
    expect(screen.getByLabelText(/top-k/i)).toHaveValue(DEFAULT_RAG_CONFIG.topK);
    expect(screen.getByLabelText(/system prompt/i)).toHaveValue(DEFAULT_SYSTEM_PROMPT);
  });

  it('saves updated RAG config and triggers success toast', async () => {
    api.get.mockResolvedValueOnce({ data: { ragConfig: mockProject.ragConfig } });
    api.put.mockResolvedValueOnce({
      data: {
        ragConfig: {
          chunkSize: 800,
          chunkOverlap: 120,
          topK: 6,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
        },
      },
    });

    const onProjectUpdated = vi.fn();
    renderWithToast(
      <RagConfigTab project={mockProject} onProjectUpdated={onProjectUpdated} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/chunk size/i)).toHaveValue(500);
    });

    fireEvent.change(screen.getByLabelText(/chunk size/i), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText(/chunk overlap/i), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText(/top-k/i), { target: { value: '6' } });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/projects/proj-123/rag-config', {
        chunkSize: 800,
        chunkOverlap: 120,
        topK: 6,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      });
      expect(
        screen.getByText('RAG configuration saved successfully.'),
      ).toBeInTheDocument();
      expect(onProjectUpdated).toHaveBeenCalled();
    });
  });
});
