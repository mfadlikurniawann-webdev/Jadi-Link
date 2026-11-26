'use client';

import { useI18n } from '@/lib/use-i18n';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Icon } from '@/components/icons';
import { CopyButton, ErrorBox, Spinner, StatusBadge } from '@/components/ui';
import { isAbortError } from '@/lib/api';
import { dateTime, displayUrl, linkStatus, number } from '@/lib/format';
import type { LinkList, ShortLink } from '@/lib/types';
import { DeleteLinkDialog } from './delete-link-dialog';
import { LinkEditor } from './link-editor';

export function Dashboard() {
  const { request } = useAuth();
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<LinkList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<ShortLink | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ShortLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    // Fetch state belongs to this request; old pages are aborted on navigation.
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await request<LinkList>(`/links?page=${page}&limit=20`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setData(result);
      } catch (failure) {
        if (!isAbortError(failure)) setError(failure);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [request, page, revision]);

  const items = useMemo(
    () => (data?.page === page ? data.items : []),
    [data, page],
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (link) =>
          (filter === 'all' || linkStatus(link) === filter) &&
          `${link.code} ${link.targetUrl}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [items, filter, search],
  );
  const activeCount = items.filter(
    (link) => linkStatus(link) === 'active',
  ).length;
  const refresh = () => setRevision((value) => value + 1);
  async function toggle(link: ShortLink) {
    setBusy(link.id);
    setActionError(null);
    setNotice(null);
    try {
      const updated = await request<ShortLink>(`/links/${link.id}`, {
        method: 'PATCH',
        body: { isActive: !link.isActive },
      });
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      setNotice(
        updated.isActive
          ? t('Tautan diaktifkan.', 'Link activated.')
          : t('Tautan dinonaktifkan.', 'Link deactivated.'),
      );
    } catch (failure) {
      setActionError(failure);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="animate-enter">
      <div className="page-heading">
        <h1>{t('Tautan', 'Links')}</h1>
        <button
          className="button button-primary"
          onClick={() => setEditor('new')}
          disabled={Boolean(busy)}
        >
          <Icon name="plus" width={18} />
          {t('Buat tautan', 'New link')}
        </button>
      </div>
      <div className="stats-grid stagger">
        <div className="stat-card">
          <div className="stat-top">
            <span>{t('Di halaman ini', 'On this page')}</span>
          </div>
          <strong>{loading ? '—' : number(items.length)}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>{t('Aktif', 'Active')}</span>
            <span className="dot dot-accent" />
          </div>
          <strong>{loading ? '—' : number(activeCount)}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>{t('Tidak aktif', 'Not active')}</span>
            <span className="dot dot-dim" />
          </div>
          <strong>{loading ? '—' : number(items.length - activeCount)}</strong>
        </div>
      </div>
      {notice && (
        <div className="success-box mb-5" role="status">
          <Icon name="check" />
          <p className="flex-1">{notice}</p>
          <button
            className="icon-button"
            aria-label={t('Tutup notifikasi', 'Dismiss notice')}
            onClick={() => setNotice(null)}
          >
            <Icon name="close" width={16} />
          </button>
        </div>
      )}
      {actionError != null && (
        <div className="mb-5">
          <ErrorBox error={actionError} />
        </div>
      )}
      <section className="panel">
        <div className="link-filters">
          <div className="search-field">
            <Icon name="search" width={17} />
            <input
              aria-label={t('Cari di halaman ini', 'Search this page')}
              placeholder={t('Cari…', 'Search…')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <label className="filter-select">
            <span className="sr-only">
              {t('Filter status halaman ini', 'Filter status on this page')}
            </span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">{t('Semua', 'All')}</option>
              <option value="active">{t('Aktif', 'Active')}</option>
              <option value="inactive">{t('Nonaktif', 'Inactive')}</option>
              <option value="expired">{t('Kedaluwarsa', 'Expired')}</option>
            </select>
          </label>
          <button
            className="icon-button bordered"
            onClick={refresh}
            disabled={loading || Boolean(busy)}
            aria-label={t('Muat ulang', 'Reload')}
            title={t('Muat ulang', 'Reload')}
          >
            <Icon
              name="refresh"
              width={16}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        </div>
        {error != null && (
          <div className="px-5 pb-5">
            <ErrorBox error={error} onRetry={refresh} />
          </div>
        )}
        {loading ? (
          <div
            className="loading-rows"
            aria-label={t('Memuat daftar tautan', 'Loading links')}
            role="status"
          >
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="skeleton-row">
                <span className="skeleton size-10 rounded-xl" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-2/5" />
                  <div className="skeleton mt-3 h-2 w-3/5" />
                </div>
                <span className="skeleton h-6 w-16" />
              </div>
            ))}
          </div>
        ) : error == null && filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="link" width={28} height={28} />
            </span>
            <h3>
              {items.length
                ? t('Belum ada yang cocok.', 'No matches yet.')
                : t('Tautan pertamamu menunggu.', 'Your first link awaits.')}
            </h3>
            {items.length > 0 && (
              <p>
                {t(
                  'Coba kata atau filter lain.',
                  'Try another word or filter.',
                )}
              </p>
            )}
            {!items.length && (
              <button
                className="button button-primary mt-5"
                onClick={() => setEditor('new')}
              >
                <Icon name="plus" width={16} />
                {t('Buat tautan pertama', 'Create your first link')}
              </button>
            )}
          </div>
        ) : (
          error == null && (
            <div className="table-scroll">
              <table className="links-table">
                <thead>
                  <tr>
                    <th>{t('Tautan', 'Link')}</th>
                    <th>Status</th>
                    <th>{t('Dibuat', 'Created')}</th>
                    <th>
                      <span className="sr-only">
                        {t('Tindakan', 'Actions')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div className="min-w-0">
                          <div className="min-w-0">
                            <Link
                              className="code-link"
                              href={`/links/${link.id}`}
                            >
                              {displayUrl(link.shortUrl)}
                              <Icon name="external" width={13} />
                            </Link>
                            <p
                              className="target-preview"
                              title={link.targetUrl}
                            >
                              {link.targetUrl}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge link={link} />
                      </td>
                      <td className="date-cell">{dateTime(link.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <CopyButton
                            compact
                            value={link.shortUrl}
                            label={`${t('Salin', 'Copy')} ${link.code}`}
                          />
                          <button
                            className={`toggle ${link.isActive ? 'is-on' : ''}`}
                            type="button"
                            role="switch"
                            aria-checked={link.isActive}
                            aria-label={`${link.isActive ? t('Nonaktifkan', 'Deactivate') : t('Aktifkan', 'Activate')} ${link.code}`}
                            disabled={loading || Boolean(busy)}
                            onClick={() => void toggle(link)}
                          >
                            {busy === link.id ? (
                              <span className="toggle-loading" />
                            ) : (
                              <span />
                            )}
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Edit ${link.code}`}
                            title={t('Edit tautan', 'Edit link')}
                            onClick={() => setEditor(link)}
                            disabled={Boolean(busy)}
                          >
                            <Icon name="edit" width={17} />
                          </button>
                          <button
                            className="icon-button danger-hover"
                            aria-label={`${t('Hapus', 'Delete')} ${link.code}`}
                            title={t('Hapus tautan', 'Delete link')}
                            onClick={() => setDeleting(link)}
                            disabled={Boolean(busy)}
                          >
                            <Icon name="trash" width={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        <div className="pagination">
          <p>
            {loading ? (
              <Spinner />
            ) : (
              t(
                `${filtered.length} tautan ditampilkan · halaman ${page}`,
                `${filtered.length} ${filtered.length === 1 ? 'link' : 'links'} shown · page ${page}`,
              )
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="button button-secondary button-small"
              disabled={page <= 1 || loading || Boolean(busy)}
              onClick={() => setPage(page - 1)}
            >
              <Icon name="back" width={15} />
              {t('Sebelumnya', 'Previous')}
            </button>
            <button
              className="button button-secondary button-small"
              disabled={
                !data?.hasNextPage ||
                data.page !== page ||
                loading ||
                Boolean(busy)
              }
              onClick={() => setPage(page + 1)}
            >
              {t('Berikutnya', 'Next')}
              <Icon name="arrow" width={15} />
            </button>
          </div>
        </div>
      </section>
      {editor && (
        <LinkEditor
          link={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNotice(
              editor === 'new'
                ? t('Tautan dibuat.', 'Link created.')
                : t('Perubahan disimpan.', 'Changes saved.'),
            );
            setEditor(null);
            if (page !== 1) setPage(1);
            else refresh();
          }}
        />
      )}
      {deleting && (
        <DeleteLinkDialog
          link={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setNotice(t('Tautan dihapus.', 'Link deleted.'));
            if (items.length === 1 && page > 1) setPage(page - 1);
            else refresh();
          }}
        />
      )}
    </div>
  );
}
