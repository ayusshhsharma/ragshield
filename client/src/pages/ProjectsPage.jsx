import { FolderPlus, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectModal from '../components/ProjectModal.jsx';
import Spinner from '../components/Spinner.jsx';
import api from '../services/api.js';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/projects');
      setProjects(res.data.projects || []);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to load projects';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (data) => {
    const res = await api.post('/projects', data);
    const newProject = res.data.project;
    setProjects((prev) => [newProject, ...prev]);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(`/projects/${deleteTarget.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to delete project';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Projects</h1>
          <p className="text-xs text-muted mt-0.5">
            Manage isolated workspaces for RAG prompt-injection testing and defense benchmarking.
          </p>
        </div>

        <Button
          type="button"
          variant="brand"
          onClick={() => setCreateModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
          New Project
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <Button
            type="button"
            variant="secondary"
            onClick={fetchProjects}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-surface border border-line rounded-lg">
          <Spinner size="lg" className="text-brand" />
          <p className="text-xs font-mono text-muted">Loading projects...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          description="Create your first project workspace to upload documents, configure defenses, and benchmark prompt injection attacks."
          action={
            <Button
              type="button"
              variant="brand"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Create Project
            </Button>
          }
        />
      )}

      {/* Projects Grid */}
      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(p) => {
                setDeleteError(null);
                setDeleteTarget(p);
              }}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <ProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        itemName={deleteTarget?.name || 'this project'}
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
