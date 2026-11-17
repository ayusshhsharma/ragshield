import { useState } from 'react';
import Button from './Button.jsx';
import ErrorBanner from './ErrorBanner.jsx';
import Input from './Input.jsx';
import Modal from './Modal.jsx';

export default function ProjectModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setErrors({});
    setServerError('');
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const nextErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      nextErrors.name = 'Project name is required';
    } else if (trimmedName.length > 100) {
      nextErrors.name = 'Project name cannot exceed 100 characters';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      resetForm();
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to create project';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Project">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <ErrorBanner message={serverError} onDismiss={() => setServerError('')} />
        )}

        <Input
          id="project-name"
          label="Project Name"
          required
          placeholder="e.g. Acme Customer Support RAG"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          error={errors.name}
          autoFocus
        />

        <div className="space-y-1.5">
          <label
            htmlFor="project-description"
            className="block text-xs font-medium text-ink"
          >
            Description
          </label>
          <textarea
            id="project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of the RAG application and target domain..."
            className="w-full bg-base border border-line rounded-md text-sm text-ink placeholder-muted px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface focus:border-brand focus:ring-brand/40 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}
