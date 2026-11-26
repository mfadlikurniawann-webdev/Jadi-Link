'use client';

import { useI18n } from '@/lib/use-i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Icon } from '@/components/icons';
import { ErrorBox, Modal, Spinner } from '@/components/ui';
import { errorMessage, isAbortError } from '@/lib/api';
import type { ShortLink } from '@/lib/types';
import { linkPayload, toLocalDateTime } from '@/lib/validation';

export function LinkEditor({
  link,
  onClose,
  onSaved,
}: {
  link?: ShortLink;
  onClose: () => void;
  onSaved: (link: ShortLink) => void;
}) {
  const { request } = useAuth();
  const { t } = useI18n();
  const id = useId();
  const controller = useRef<AbortController | null>(null);
  const [targetUrl, setTargetUrl] = useState(link?.targetUrl ?? '');
  const [alias, setAlias] = useState(link?.code ?? '');
  const [expiresAt, setExpiresAt] = useState(
    toLocalDateTime(link?.expiresAt ?? null),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let body;
    try {
      body = linkPayload({ targetUrl, alias, expiresAt }, link);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t('Periksa isianmu.', 'Check your input.'),
      );
      return;
    }
    setBusy(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const result = await request<ShortLink>(
        link ? `/links/${link.id}` : '/links',
        {
          method: link ? 'PATCH' : 'POST',
          body,
          signal: controller.current.signal,
        },
      );
      if (!controller.current.signal.aborted) onSaved(result);
    } catch (failure) {
      if (!isAbortError(failure)) {
        setError(errorMessage(failure));
        setBusy(false);
      }
    }
  }
  return (
    <Modal
      open
      title={
        link ? t('Ubah tautan', 'Edit link') : t('Tautan baru', 'New link')
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        {error && <ErrorBox error={error} />}
        <div>
          <label className="field-label" htmlFor={`${id}-target`}>
            {t('URL tujuan', 'Destination URL')}
          </label>
          <input
            id={`${id}-target`}
            className="input"
            type="url"
            placeholder={t(
              'https://contoh.com/cerita-panjangmu',
              'https://example.com/your-long-story',
            )}
            required
            maxLength={2048}
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${id}-alias`}>
            Alias{' '}
            {link ? (
              ''
            ) : (
              <span className="font-normal text-muted">
                ({t('opsional', 'optional')})
              </span>
            )}
          </label>
          <input
            id={`${id}-alias`}
            className="input"
            placeholder={t('misalnya: ide-besarku', 'e.g. big-idea')}
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            readOnly={Boolean(link)}
            disabled={busy}
            maxLength={64}
          />
          <p className="field-hint">
            {link
              ? t('Alias tidak bisa diubah.', 'Alias cannot be changed.')
              : t(
                  'Kosongkan untuk kode otomatis.',
                  'Leave empty for an automatic code.',
                )}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="field-label" htmlFor={`${id}-expires`}>
              {t('Kedaluwarsa', 'Expiry')}{' '}
              <span className="font-normal text-muted">
                ({t('opsional', 'optional')})
              </span>
            </label>
            {expiresAt && (
              <button
                className="mb-2 text-xs font-medium text-accent"
                type="button"
                onClick={() => setExpiresAt('')}
                disabled={busy}
              >
                {t('Hapus', 'Clear')}
              </button>
            )}
          </div>
          <input
            id={`${id}-expires`}
            className="input"
            type="datetime-local"
            step="1"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t('Batal', 'Cancel')}
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy ? (
              <Spinner label={t('Menyimpan…', 'Saving…')} />
            ) : (
              <>
                {link
                  ? t('Simpan perubahan', 'Save changes')
                  : t('Buat tautan', 'Create link')}
                <Icon name="arrow" width={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
