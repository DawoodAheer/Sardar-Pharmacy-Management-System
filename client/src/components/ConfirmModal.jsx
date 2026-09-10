
import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({ title = "Are you sure?", message, onConfirm, onCancel, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
          <h3 id="confirm-modal-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Message */}
        <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
