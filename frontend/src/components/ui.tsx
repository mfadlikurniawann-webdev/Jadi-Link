'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons';
import { errorMessage } from '@/lib/api';
import type { ShortLink } from '@/lib/types';
import { linkStatus } from '@/lib/format';

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function LoadingPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">
      <Spinner label="Menyiapkan ruangmu…" />
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
  return (
    <div className="error-box" role="alert">
      <Icon name="alert" />
      <div className="flex-1">
        <p>{typeof error === 'string' ? error : errorMessage(error)}</p>
        {onRetry && (
          <button
            className="mt-2 font-semibold underline underline-offset-4"
            onClick={onRetry}
          >
            Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ link }: { link: ShortLink }) {
  const status = linkStatus(link);
  return (
    <span className={`status-badge status-${status}`}>
      <span aria-hidden="true" />
      {status === 'active'
        ? 'Aktif'
        : status === 'expired'
          ? 'Kedaluwarsa'
          : 'Nonaktif'}
    </span>
  );
}

export function CopyButton({
  value,
  label = 'Salin tautan',
  compact = false,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
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
        aria-label={copied ? 'Tautan tersalin' : label}
        title={label}
      >
        <Icon name={copied ? 'check' : 'copy'} />
        {!compact && (copied ? 'Tersalin' : label)}
      </button>
      <span className="sr-only" role="status">
        {copied ? 'Tautan berhasil disalin.' : ''}
      </span>
      {failed && (
        <span className="max-w-60 text-xs text-red-700" role="alert">
          Clipboard tidak tersedia. Salin URL yang ditampilkan secara manual.
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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">JADI LINK / WORKSPACE</span>
            <h2 id={id} className="mt-3 text-2xl font-semibold tracking-tight">
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
            aria-label="Tutup dialog"
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
