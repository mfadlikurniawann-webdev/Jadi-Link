import { number } from '@/lib/format';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';

export function Breakdown({
  title,
  caption,
  icon,
  total,
  rows,
}: {
  title: string;
  caption: string;
  icon: IconName;
  total: number;
  rows: { label: string; clicks: number }[];
}) {
  return (
    <section className="panel breakdown">
      <div className="breakdown-heading">
        <span className="row-link-icon">
          <Icon name={icon} width={18} />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted">{caption}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="breakdown-empty">
          Data akan muncul setelah ada klik tersimpan.
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
