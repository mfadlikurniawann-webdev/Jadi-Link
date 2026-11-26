'use client';

import { useI18n } from '@/lib/use-i18n';
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
  const { t } = useI18n();
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
      title={t('Hapus tautan ini?', 'Delete this link?')}
      description={t(
        `“${link.code}” dan statistiknya akan dihapus permanen.`,
        `“${link.code}” and its stats will be permanently deleted.`,
      )}
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
          {t('Batal', 'Cancel')}
        </button>
        <button
          className="button button-danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? (
            <Spinner label={t('Menghapus…', 'Deleting…')} />
          ) : (
            <>
              <Icon name="trash" width={16} />
              {t('Ya, hapus tautan', 'Yes, delete link')}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
