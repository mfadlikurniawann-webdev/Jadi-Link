'use client';

import { useI18n } from '@/lib/use-i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons';
import { errorMessage } from '@/lib/api';
import type { ShortLink } from '@/lib/types';
import { linkStatus } from '@/lib/format';

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('Memuat…', 'Loading…')}</span>
    </span>
  );
}

export function LoadingPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">
      <Spinner />
    </div>
  );
}

export function ErrorBox({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="error-box" role="alert">
      <Icon name="alert" />
      <div className="flex-1">
        <p>{typeof error === 'string' ? error : errorMessage(error)}</p>
        {onRetry && (
          <button
            className="mt-2 font-medium underline underline-offset-4"
            onClick={onRetry}
          >
            {t('Coba lagi', 'Try again')}
          </button>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ link }: { link: ShortLink }) {
  const { t } = useI18n();
  const status = linkStatus(link);
  return (
    <span className={`status-badge status-${status}`}>
      <span aria-hidden="true" />
      {status === 'active'
        ? t('Aktif', 'Active')
        : status === 'expired'
          ? t('Kedaluwarsa', 'Expired')
          : t('Nonaktif', 'Inactive')}
    </span>
  );
}

export function CopyButton({
  value,
  label: customLabel,
  compact = false,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const label = customLabel ?? t('Salin tautan', 'Copy link');
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        className={compact ? 'icon-button' : 'button button-secondary'}
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? t('Tautan tersalin', 'Link copied') : label}
        title={label}
      >
        <Icon name={copied ? 'check' : 'copy'} />
        {!compact && (copied ? t('Tersalin', 'Copied') : label)}
      </button>
      <span className="sr-only" role="status">
        {copied ? t('Tautan berhasil disalin.', 'Link copied.') : ''}
      </span>
      {failed && (
        <span className="max-w-60 text-xs text-red-400" role="alert">
          {t('Gagal menyalin. Salin manual.', 'Copy failed. Copy it manually.')}
        </span>
      )}
    </span>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
    return () => {
      if (dialog?.open) dialog.close();
      if (open && previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="p-6 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={id} className="text-2xl">
              {title}
            </h2>
            {description && (
              <p
                id={`${id}-description`}
                className="mt-2 text-sm leading-6 text-muted"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t('Tutup dialog', 'Close dialog')}
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
