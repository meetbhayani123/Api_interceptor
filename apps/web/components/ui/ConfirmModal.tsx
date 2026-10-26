'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';

interface ConfirmModalProps {
  title: string;
  /** What will happen. Shown as the dialog body. */
  children: React.ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * A plain yes/no confirmation for a destructive action.
 *
 * Distinct from DeleteModal, which also demands a password: this is for things
 * already backed by a copy elsewhere, where a confirmation is the right amount
 * of friction.
 */
export function ConfirmModal({
  title, children, confirmLabel = 'Delete', busyLabel = 'Deleting…', onConfirm, onClose,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err?.message || 'That did not work.');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} labelledBy="confirm-modal-title">
      <div className="absolute top-0 right-0 w-32 h-32 bg-danger/10 rounded-bl-[100px] pointer-events-none" />

      <h3 id="confirm-modal-title" className="text-xl font-bold mb-2 flex items-center gap-2 text-danger">
        <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {title}
      </h3>

      <div className="text-sm text-slate-300 mb-6">{children}</div>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-rose-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse xs:flex-row gap-3 xs:justify-end items-stretch xs:items-center">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-[44px] px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-slate-700/50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="min-h-[44px] px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-md focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none bg-danger hover:brightness-110 text-white disabled:opacity-60"
        >
          {busy ? <><Spinner size="sm" /> {busyLabel}</> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
