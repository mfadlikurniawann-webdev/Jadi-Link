import { number } from '@/lib/format';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';

export function Breakdown({
  title,
  icon,
  total,
  rows,
}: {
  title: string;
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
        <h2 className="font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="breakdown-empty">Belum ada data.</div>
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
