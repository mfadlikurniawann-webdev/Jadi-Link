'use client';

import { useI18n } from '@/lib/use-i18n';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Icon } from '@/components/icons';
import { CopyButton, ErrorBox, Spinner, StatusBadge } from '@/components/ui';
import { ApiError, errorMessage, isAbortError } from '@/lib/api';
import { countryName, dateTime, displayUrl, number } from '@/lib/format';
import type { Analytics, ShortLink } from '@/lib/types';
import { safeHttpUrl } from '@/lib/validation';
import { Breakdown } from '../analytics/breakdown';
import { ClickChart } from '../analytics/click-chart';
import { DeleteLinkDialog } from './delete-link-dialog';
import { LinkEditor } from './link-editor';

export function LinkDetail({ id }: { id: string }) {
  const { request } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [link, setLink] = useState<ShortLink | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [statsError, setStatsError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loadStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingStats(true);
      setStatsError(null);
      try {
        const result = await request<Analytics>(`/links/${id}/analytics`, {
          signal,
        });
        if (!signal?.aborted) setAnalytics(result);
      } catch (failure) {
        if (!isAbortError(failure)) setStatsError(failure);
      } finally {
        if (!signal?.aborted) setLoadingStats(false);
      }
    },
    [id, request],
  );
  useEffect(() => {
    const controller = new AbortController();
    void request<ShortLink>(`/links/${id}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setLink(result);
      })
      .catch((failure: unknown) => {
        if (!isAbortError(failure)) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    void request<Analytics>(`/links/${id}/analytics`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setAnalytics(result);
      })
      .catch((failure: unknown) => {
        if (!isAbortError(failure)) setStatsError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStats(false);
      });
    return () => controller.abort();
  }, [id, request, revision]);
  async function toggle() {
    if (!link) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await request<ShortLink>(`/links/${id}`, {
        method: 'PATCH',
        body: { isActive: !link.isActive },
      });
      setLink(updated);
      setNotice(
        updated.isActive
          ? t('Tautan diaktifkan.', 'Link activated.')
          : t('Tautan dinonaktifkan.', 'Link deactivated.'),
      );
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const back = (
    <Link href="/dashboard" className="back-link mb-6">
      <Icon name="back" width={16} />
      {t('Semua tautan', 'All links')}
    </Link>
  );
  const retry = () => {
    setLoading(true);
    setError(null);
    setLoadingStats(true);
    setStatsError(null);
    setRevision((value) => value + 1);
  };
  if (loading && !link)
    return (
      <div>
        {back}
        <div className="panel p-10 text-sm text-muted">
          <Spinner />
        </div>
      </div>
    );
  if (error != null)
    return (
      <div>
        {back}
        <div className="panel p-7">
          {error instanceof ApiError && error.status === 404 ? (
            <div className="empty-state">
              <Icon name="link" width={30} />
              <h1>{t('Tautan tidak ditemukan.', 'Link not found.')}</h1>

              <Link href="/dashboard" className="button button-primary mt-5">
                {t('Kembali', 'Back')}
              </Link>
            </div>
          ) : (
            <ErrorBox error={error} onRetry={retry} />
          )}
        </div>
      </div>
    );
  if (!link) return null;
  const target = safeHttpUrl(link.targetUrl);
  const shortUrl = safeHttpUrl(link.shortUrl);
  const devices = {
    desktop: 'Desktop',
    mobile: t('Ponsel', 'Mobile'),
    tablet: 'Tablet',
    bot: 'Bot',
    unknown: t('Tidak diketahui', 'Unknown'),
  };
  return (
    <div className="animate-enter">
      {back}
      <div className="page-heading">
        <div>
          <h1>{link.code}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge link={link} />
            <span className="text-xs text-muted">
              {dateTime(link.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button button-secondary"
            onClick={() => setEditing(true)}
          >
            <Icon name="edit" width={16} />
            {t('Edit tautan', 'Edit link')}
          </button>
          <CopyButton value={link.shortUrl} />
        </div>
      </div>
      {notice && (
        <div className="success-box mb-5" role="status">
          <Icon name="check" />
          <p>{notice}</p>
        </div>
      )}
      {actionError != null && (
        <div className="mb-5">
          <ErrorBox error={actionError} />
        </div>
      )}
      <section className="panel link-summary">
        <div className="summary-url">
          <div className="min-w-0">
            {shortUrl ? (
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="summary-short"
              >
                {displayUrl(link.shortUrl)}
                <Icon name="external" width={16} />
              </a>
            ) : (
              <p>{link.shortUrl}</p>
            )}
            <p className="summary-target">
              {target ? (
                <a href={target} target="_blank" rel="noopener noreferrer">
                  {link.targetUrl}
                </a>
              ) : (
                link.targetUrl
              )}
            </p>
          </div>
        </div>
        <div className="summary-settings">
          <div>
            <span className="text-muted">{t('Kedaluwarsa', 'Expires')} </span>
            <span className="font-medium">{dateTime(link.expiresAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted">{t('Aktif', 'Active')}</span>
            <button
              className={`toggle ${link.isActive ? 'is-on' : ''}`}
              role="switch"
              aria-label={t('Status aktif tautan', 'Link active status')}
              aria-checked={link.isActive}
              onClick={() => void toggle()}
              disabled={busy}
            >
              {busy ? <span className="toggle-loading" /> : <span />}
            </button>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>{t('Analitik', 'Analytics')}</h2>
        <button
          className="button button-secondary button-small"
          onClick={() => void loadStats()}
          disabled={loadingStats}
        >
          <Icon
            name="refresh"
            width={15}
            className={loadingStats ? 'animate-spin' : ''}
          />
          {t('Perbarui', 'Refresh')}
        </button>
      </div>
      {statsError != null ? (
        <ErrorBox error={statsError} onRetry={() => void loadStats()} />
      ) : loadingStats && !analytics ? (
        <div className="panel p-10 text-sm text-muted">
          <Spinner />
        </div>
      ) : (
        analytics && (
          <>
            <div
              className={`stats-grid stagger ${loadingStats ? 'opacity-60' : ''}`}
              aria-busy={loadingStats}
            >
              <div className="stat-card">
                <div className="stat-top">
                  <span>{t('Total klik', 'Total clicks')}</span>
                </div>
                <strong>{number(analytics.totalClicks)}</strong>
                <p>{t('Semua waktu', 'All time')}</p>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span>{t('Klik 30 hari', 'Clicks, 30 days')}</span>
                </div>
                <strong>{number(analytics.clicksLast30Days)}</strong>
                <p>UTC</p>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <span>{t('Visitor unik', 'Unique visitors')}</span>
                </div>
                <strong>{number(analytics.uniqueVisitorsLast30Days)}</strong>
                <p>{t('Estimasi · 30 hari', 'Estimated · 30 days')}</p>
              </div>
            </div>
            <ClickChart data={analytics.dailyClicks} />
            <div className="breakdown-grid">
              <Breakdown
                title="Referrer"
                total={analytics.clicksLast30Days}
                rows={analytics.topReferrers.map((item) => ({
                  label:
                    item.referrer ??
                    t('Langsung / tidak diketahui', 'Direct / unknown'),
                  clicks: item.clicks,
                }))}
              />
              <Breakdown
                title={t('Negara', 'Countries')}
                total={analytics.clicksLast30Days}
                rows={analytics.countries.map((item) => ({
                  label: countryName(item.country),
                  clicks: item.clicks,
                }))}
              />
              <Breakdown
                title={t('Perangkat', 'Devices')}
                total={analytics.clicksLast30Days}
                rows={analytics.devices.map((item) => ({
                  label: devices[item.device],
                  clicks: item.clicks,
                }))}
              />
            </div>
          </>
        )
      )}
      <div className="danger-zone">
        <button
          className="button button-danger-outline"
          onClick={() => setDeleting(true)}
        >
          <Icon name="trash" width={16} />
          {t('Hapus tautan', 'Delete link')}
        </button>
      </div>
      {editing && (
        <LinkEditor
          link={link}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setLink(updated);
            setEditing(false);
            setNotice(t('Perubahan disimpan.', 'Changes saved.'));
          }}
        />
      )}
      {deleting && (
        <DeleteLinkDialog
          link={link}
          onClose={() => setDeleting(false)}
          onDeleted={() => router.replace('/dashboard')}
        />
      )}
    </div>
  );
}
