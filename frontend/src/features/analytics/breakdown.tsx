'use client';

import { useI18n } from '@/lib/use-i18n';
import { number } from '@/lib/format';

export function Breakdown({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: { label: string; clicks: number }[];
}) {
  const { t } = useI18n();
  return (
    <section className="panel breakdown">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <div className="breakdown-empty">
          {t('Belum ada data.', 'No data yet.')}
        </div>
      ) : (
        <div className="breakdown-rows">
          {rows.map((row) => (
            <div key={row.label} className="breakdown-row">
              <div>
                <span title={row.label}>{row.label}</span>
                <strong>
                  {number(row.clicks)}
                  <small>
                    {total
                      ? `${Math.round((row.clicks / total) * 100)}%`
                      : '0%'}
                  </small>
                </strong>
              </div>
              <span className="bar-track">
                <span
                  style={{
                    width: `${total ? Math.min(100, (row.clicks / total) * 100) : 0}%`,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
