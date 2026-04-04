'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';

interface DeleteModalProps {
  match: any;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteModal({ match, onClose, onDeleted }: DeleteModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      await api.deleteMatch(match._id, password);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-bl-[100px] pointer-events-none" />

      <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-rose-400">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Confirm Deletion
      </h3>

      <p className="text-sm text-slate-300 mb-6">
        Permanently delete <strong className="text-white">{match.name}</strong>. All snapshots and match data will be wiped. Ensure polling is stopped first.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-900/20 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50 mb-6"
          placeholder="Enter admin password"
          autoFocus
        />

        <div className="flex gap-3 justify-end items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !password}
            className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-md
              ${loading || !password
                ? 'bg-rose-500/20 text-rose-300/50 cursor-not-allowed'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]'
              }`}
          >
            {loading ? <Spinner size="sm" /> : 'Wipe Record'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
