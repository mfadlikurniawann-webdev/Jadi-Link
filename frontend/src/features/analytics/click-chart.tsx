'use client';

import { useI18n } from '@/lib/use-i18n';
import { useId, useState } from 'react';
import { chartGeometry } from '@/lib/chart';
import { dayLabel, number } from '@/lib/format';

export function ClickChart({
  data,
}: {
  data: { date: string; clicks: number }[];
}) {
  const [selected, setSelected] = useState(29);
  const { t } = useI18n();
  const gradient = useId().replace(/:/g, '');
  const chart = chartGeometry(data.map((item) => item.clicks));
  const index = Math.min(selected, data.length - 1);
  const active = data[index];
  const point = chart.points[index];
  const hasClicks = data.some((item) => item.clicks > 0);
  const total = number(data.reduce((sum, item) => sum + item.clicks, 0));
  return (
    <section className="panel chart-panel">
      <div className="panel-toolbar">
        <h2 className="font-medium">{t('Klik 30 hari', 'Clicks, 30 days')}</h2>
        <div className="chart-selected" aria-live="polite">
          <span>
            {active
              ? dayLabel(active.date, true)
              : t('Belum ada data', 'No data yet')}
          </span>
          <strong>
            {active ? number(active.clicks) : '0'}{' '}
            <span>{t('klik', 'clicks')}</span>
          </strong>
        </div>
      </div>
      <div
        className="chart-wrap"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) * 760;
          setSelected(
            Math.min(
              data.length - 1,
              Math.max(0, Math.round(((x - 20) / 720) * (data.length - 1))),
            ),
          );
        }}
      >
        <svg
          viewBox="0 0 760 220"
          className="click-chart"
          role="img"
          aria-label={t(
            `Grafik klik harian 30 hari. Total ${total} klik.`,
            `Daily clicks chart, 30 days. Total ${total} clicks.`,
          )}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd60a" stopOpacity=".22" />
              <stop offset="100%" stopColor="#ffd60a" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 80, 140, 200].map((y) => (
            <line
              key={y}
              x1="20"
              y1={y}
              x2="740"
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray="4 6"
            />
          ))}
          <path
            className="chart-area"
            d={chart.area}
            fill={`url(#${gradient})`}
          />
          <path
            className="chart-line"
            pathLength={1}
            d={chart.line}
            fill="none"
            stroke="#ffd60a"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {point && (
            <>
              <line
                className="chart-cursor"
                x1={point.x}
                y1="20"
                x2={point.x}
                y2="200"
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="3 5"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                className="chart-cursor"
                fill="#ffd60a"
                stroke="#0b0c0f"
                strokeWidth="3"
              />
            </>
          )}
        </svg>
        {!hasClicks && (
          <div className="chart-empty">
            {t('Belum ada klik.', 'No clicks yet.')}
          </div>
        )}
      </div>
      <div className="chart-dates">
        {[0, 7, 14, 21, 29].map((item) => (
          <span key={item}>{data[item] ? dayLabel(data[item].date) : ''}</span>
        ))}
      </div>
      <div className="chart-access">
        <label htmlFor={`${gradient}-slider`} className="sr-only">
          {t('Pilih tanggal grafik', 'Pick a chart date')}
        </label>
        <input
          id={`${gradient}-slider`}
          type="range"
          min="0"
          max={Math.max(0, data.length - 1)}
          value={Math.max(0, index)}
          onChange={(event) => setSelected(Number(event.target.value))}
          aria-valuetext={
            active
              ? `${dayLabel(active.date, true)}, ${active.clicks} ${t('klik', 'clicks')}`
              : t('Belum ada data', 'No data yet')
          }
        />
        <details>
          <summary>{t('Lihat data harian', 'View daily data')}</summary>
          <div className="daily-table-wrap">
            <table>
              <caption className="sr-only">
                {t('Klik harian dalam UTC', 'Daily clicks in UTC')}
              </caption>
              <thead>
                <tr>
                  <th>{t('Tanggal (UTC)', 'Date (UTC)')}</th>
                  <th>{t('Klik', 'Clicks')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((day) => (
                  <tr key={day.date}>
                    <td>{dayLabel(day.date, true)}</td>
                    <td>{number(day.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
