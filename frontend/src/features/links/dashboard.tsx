'use client';

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
  const { request, user } = useAuth();
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
          ? 'Status tautan diaktifkan. Tanggal kedaluwarsa tetap berlaku.'
          : 'Tautan dinonaktifkan.',
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
        <div>
          <span className="eyebrow">RUANG TAUTANMU</span>
          <h1>
            Semua bermula dari satu link<span className="text-olive">.</span>
          </h1>
          <p>Kelola, bagikan, lalu lihat cerita di balik setiap klik.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setEditor('new')}
          disabled={Boolean(busy)}
        >
          <Icon name="plus" width={18} />
          Buat tautan
        </button>
      </div>
      <div className="stats-grid dashboard-stats">
        <div className="stat-card">
          <div className="stat-top">
            <span>Ditampilkan</span>
            <Icon name="link" />
          </div>
          <strong>{loading ? '—' : number(items.length)}</strong>
          <p>Tautan di halaman ini</p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span>Sedang aktif</span>
            <span className="green-dot" />
          </div>
          <strong>
            {loading
              ? '—'
              : number(
                  items.filter((link) => linkStatus(link) === 'active').length,
                )}
          </strong>
          <p>Aktif dan belum kedaluwarsa</p>
        </div>
        <div className="stat-card stat-card-note">
          <span className="mini-label">SEDIKIT CATATAN</span>
          <p>
            Link yang pendek.
            <br />
            <strong>Cerita yang terus tumbuh.</strong>
          </p>
          <span className="text-xs text-muted">
            Buka detail tautan untuk melihat analitik.
          </span>
          <Icon
            name="arrow"
            className="stat-note-arrow"
            width={36}
            height={36}
          />
        </div>
      </div>
      {notice && (
        <div className="success-box mb-5" role="status">
          <Icon name="check" />
          <p className="flex-1">{notice}</p>
          <button
            className="icon-button"
            aria-label="Tutup notifikasi"
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
        <div className="panel-toolbar">
          <div>
            <h2 className="font-semibold">Koleksi tautan</h2>
            <p className="mt-1 text-xs text-muted">
              Hanya tautan milik {user?.email}.
            </p>
          </div>
          <button
            className="button button-quiet"
            onClick={refresh}
            disabled={loading || Boolean(busy)}
          >
            <Icon
              name="refresh"
              width={16}
              className={loading ? 'animate-spin' : ''}
            />
            Muat ulang
          </button>
        </div>
        <div className="link-filters">
          <div className="search-field">
            <Icon name="search" width={17} />
            <input
              aria-label="Cari di halaman ini"
              placeholder="Cari di halaman ini…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <label className="filter-select">
            <span className="sr-only">Filter status halaman ini</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="expired">Kedaluwarsa</option>
            </select>
          </label>
        </div>
        {error != null && (
          <div className="px-5 pb-5">
            <ErrorBox error={error} onRetry={refresh} />
          </div>
        )}
        {loading ? (
          <div
            className="loading-rows"
            aria-label="Memuat daftar tautan"
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
                ? 'Belum ada yang cocok.'
                : 'Tautan pertamamu menunggu.'}
            </h3>
            <p>
              {items.length
                ? 'Coba kata lain atau ubah filter. Pencarian hanya untuk halaman ini.'
                : 'Mulai dari URL yang ingin kamu bagikan. Kami bantu mempersingkatnya.'}
            </p>
            {!items.length && (
              <button
                className="button button-primary mt-5"
                onClick={() => setEditor('new')}
              >
                <Icon name="plus" width={16} />
                Buat tautan pertama
              </button>
            )}
          </div>
        ) : (
          error == null && (
            <div className="table-scroll">
              <table className="links-table">
                <thead>
                  <tr>
                    <th>Tautan</th>
                    <th>Status</th>
                    <th>Dibuat</th>
                    <th>
                      <span className="sr-only">Tindakan</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="row-link-icon">
                            <Icon name="link" />
                          </span>
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
                            label={`Salin ${link.code}`}
                          />
                          <button
                            className={`toggle ${link.isActive ? 'is-on' : ''}`}
                            type="button"
                            role="switch"
                            aria-checked={link.isActive}
                            aria-label={`${link.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${link.code}`}
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
                            title="Edit tautan"
                            onClick={() => setEditor(link)}
                            disabled={Boolean(busy)}
                          >
                            <Icon name="edit" width={17} />
                          </button>
                          <button
                            className="icon-button danger-hover"
                            aria-label={`Hapus ${link.code}`}
                            title="Hapus tautan"
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
              <Spinner label="Memuat…" />
            ) : (
              `${filtered.length} tautan ditampilkan · halaman ${page}`
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="button button-secondary button-small"
              disabled={page <= 1 || loading || Boolean(busy)}
              onClick={() => setPage(page - 1)}
            >
              <Icon name="back" width={15} />
              Sebelumnya
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
              Berikutnya
              <Icon name="arrow" width={15} />
            </button>
          </div>
        </div>
      </section>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted">
        <Icon name="shield" width={14} className="mt-0.5 shrink-0" />
        Angka di atas hanya untuk halaman ini. Statistik klik tersedia pada
        detail masing-masing tautan.
      </p>
      {editor && (
        <LinkEditor
          link={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNotice(
              editor === 'new'
                ? 'Tautan baru siap dibagikan.'
                : 'Perubahan berhasil disimpan.',
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
            setNotice('Tautan dan statistiknya sudah dihapus.');
            if (items.length === 1 && page > 1) setPage(page - 1);
            else refresh();
          }}
        />
      )}
    </div>
  );
}
