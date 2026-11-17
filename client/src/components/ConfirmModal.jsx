import { AlertTriangle } from 'lucide-react';
import Button from './Button.jsx';
import ErrorBanner from './ErrorBanner.jsx';
import Modal from './Modal.jsx';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  itemName,
  message,
  confirmText = 'Delete',
  loading = false,
  error = null,
}) {
  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-danger/10 text-danger shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-ink">
              {message || (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-white">{itemName}</span>?
                  This action is permanent and will delete all associated documents,
                  runs, and results.
                </>
              )}
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
