import {
  AlertCircle,
  CheckCircle2,
  Database,
  File,
  FileCode,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api.js';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../../utils/constants.js';
import Badge from '../Badge.jsx';
import Button from '../Button.jsx';
import ConfirmModal from '../ConfirmModal.jsx';
import EmptyState from '../EmptyState.jsx';
import ErrorBanner from '../ErrorBanner.jsx';
import Spinner from '../Spinner.jsx';

export default function DocumentsTab({
  project,
  onProjectUpdated,
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Demo KB load state
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const fetchDocuments = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/projects/${project.id}/documents`);
      setDocuments(res.data.documents || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load documents';
      setError(msg);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchDocuments(true);
  }, [fetchDocuments]);

  // Polling: every 2 s while any document is in 'processing' status; clear on unmount
  const hasProcessing = documents.some((d) => d.status === 'processing');

  useEffect(() => {
    if (!hasProcessing) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const res = await api.get(`/projects/${project.id}/documents`);
        setDocuments(res.data.documents || []);
      } catch {
        // Silently skip transient polling errors
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [hasProcessing, project.id]);

  // Client-side file validation & upload
  const handleUploadFile = async (file) => {
    setUploadError(null);
    if (!file) return;

    // 1. Extension check
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(
        `File type "${ext}" not supported. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
      return;
    }

    // 2. 5 MB client-side size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('File exceeds maximum allowed size of 5 MB.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/projects/${project.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newDoc = res.data.document;
      setDocuments((prev) => [newDoc, ...prev]);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to upload document';
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Load demo KB
  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    setDemoError(null);
    try {
      const res = await api.post(`/projects/${project.id}/documents/demo`);
      const newDocs = res.data.documents || [];
      setDocuments((prev) => [...newDocs, ...prev]);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load demo knowledge base';
      setDemoError(msg);
    } finally {
      setLoadingDemo(false);
    }
  };

  // Delete document
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(`/projects/${project.id}/documents/${deleteTarget.id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to delete document';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getFileIcon = (filename = '') => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return FileCode;
    if (ext === 'docx') return FileText;
    return File;
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">
            Knowledge Base Documents
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Documents uploaded here are chunked and embedded into the project vector collection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {project.demoKbLoaded ? (
            <Badge variant="success">
              <Database className="w-3.5 h-3.5 mr-1" />
              Demo KB Loaded
            </Badge>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={loadingDemo}
              onClick={handleLoadDemo}
            >
              <Database className="w-3.5 h-3.5 mr-1.5" />
              Load Demo Knowledge Base
            </Button>
          )}

          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Upload File
          </Button>
        </div>
      </div>

      {/* Error banners */}
      {demoError && (
        <ErrorBanner
          message={demoError}
          onDismiss={() => setDemoError(null)}
        />
      )}
      {uploadError && (
        <ErrorBanner
          message={uploadError}
          onDismiss={() => setUploadError(null)}
        />
      )}
      {error && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fetchDocuments(true)}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
          dragActive
            ? 'border-brand bg-brand/5'
            : 'border-line hover:border-line hover:bg-elevated/40'
        }`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload document dropzone"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleUploadFile(e.target.files[0]);
            }
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center space-y-2 py-2">
            <Spinner size="md" className="text-brand" />
            <p className="text-xs font-mono text-muted">
              Uploading & extracting text...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-1.5 py-2">
            <div className="p-2.5 rounded-full bg-elevated border border-line text-brand">
              <UploadCloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium text-ink">
              Drag & drop document here, or{' '}
              <span className="text-brand hover:underline">browse</span>
            </p>
            <p className="text-[11px] font-mono text-muted">
              TXT, PDF, DOCX up to 5 MB
            </p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-surface border border-line rounded-lg space-y-2">
          <Spinner size="md" className="text-brand" />
          <p className="text-xs font-mono text-muted">Loading documents...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && documents.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No documents in knowledge base"
          description="Upload your proprietary text documents or load the Acme Retail synthetic demo knowledge base to begin evaluation."
          action={
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Document
              </Button>
              {!project.demoKbLoaded && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={loadingDemo}
                  onClick={handleLoadDemo}
                >
                  Load Demo KB
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* Documents Table */}
      {!loading && !error && documents.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/60 text-muted border-b border-line uppercase font-mono tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Document</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Characters</th>
                  <th scope="col" className="px-4 py-3 font-medium">Chunks</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Uploaded</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono">
                {documents.map((doc) => {
                  const Icon = getFileIcon(doc.filename);
                  const isProcessing = doc.status === 'processing';
                  const isFailed = doc.status === 'failed';

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-elevated/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-sans font-medium text-ink flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-xs" title={doc.filename}>
                          {doc.filename}
                        </span>
                        {doc.isDemo && (
                          <Badge variant="muted" size="xs">demo</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted uppercase">
                        {doc.fileType?.replace('.', '') || doc.filename?.split('.').pop()}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {doc.charCount != null ? doc.charCount.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {doc.chunkCount != null ? doc.chunkCount : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isProcessing && (
                          <Badge variant="warning">
                            <Spinner size="xs" className="mr-1" />
                            processing
                          </Badge>
                        )}
                        {doc.status === 'ready' && (
                          <Badge variant="success">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            ready
                          </Badge>
                        )}
                        {isFailed && (
                          <Badge variant="danger" title={doc.error || 'Extraction failed'}>
                            <XCircle className="w-3 h-3 mr-0.5" />
                            failed
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {doc.createdAt
                          ? new Date(doc.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(doc);
                          }}
                          className="p-1 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
                          aria-label={`Delete document ${doc.filename}`}
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        itemName={deleteTarget?.filename || 'this document'}
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
