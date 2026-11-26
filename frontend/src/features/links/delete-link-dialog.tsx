'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { ErrorBox, Modal, Spinner } from '@/components/ui';
import { Icon } from '@/components/icons';
import { errorMessage } from '@/lib/api';
import type { ShortLink } from '@/lib/types';

export function DeleteLinkDialog({
  link,
  onClose,
  onDeleted,
}: {
  link: ShortLink;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { request } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await request<void>(`/links/${link.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Hapus tautan ini?"
      description={`“${link.code}” beserta seluruh statistik kliknya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
      busy={busy}
      onClose={onClose}
    >
      {error && (
        <div className="mb-5">
          <ErrorBox error={error} />
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Tetap simpan
        </button>
        <button
          className="button button-danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? (
            <Spinner label="Menghapus…" />
          ) : (
            <>
              <Icon name="trash" width={16} />
              Ya, hapus tautan
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
