'use client';

import { useId, useState } from 'react';
import { chartGeometry } from '@/lib/chart';
import { dayLabel, number } from '@/lib/format';

export function ClickChart({
  data,
}: {
  data: { date: string; clicks: number }[];
}) {
  const [selected, setSelected] = useState(29);
  const gradient = useId().replace(/:/g, '');
  const chart = chartGeometry(data.map((item) => item.clicks));
  const index = Math.min(selected, data.length - 1);
  const active = data[index];
  const point = chart.points[index];
  const hasClicks = data.some((item) => item.clicks > 0);
  return (
    <section className="panel chart-panel">
      <div className="panel-toolbar">
        <h2 className="font-semibold">Klik 30 hari</h2>
        <div className="chart-selected" aria-live="polite">
          <span>{active ? dayLabel(active.date, true) : 'Belum ada data'}</span>
          <strong>
            {active ? number(active.clicks) : '0'} <span>klik</span>
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
          aria-label={`Grafik klik harian 30 hari. Total ${number(data.reduce((sum, item) => sum + item.clicks, 0))} klik.`}
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fc5810" stopOpacity=".38" />
              <stop offset="100%" stopColor="#fc5810" stopOpacity="0" />
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
          <path d={chart.area} fill={`url(#${gradient})`} />
          <path
            d={chart.line}
            fill="none"
            stroke="#fc5810"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {point && (
            <>
              <line
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
                fill="#fc5810"
                stroke="#050505"
                strokeWidth="3"
              />
            </>
          )}
        </svg>
        {!hasClicks && <div className="chart-empty">Belum ada klik.</div>}
      </div>
      <div className="chart-dates">
        {[0, 7, 14, 21, 29].map((item) => (
          <span key={item}>{data[item] ? dayLabel(data[item].date) : ''}</span>
        ))}
      </div>
      <div className="chart-access">
        <label htmlFor={`${gradient}-slider`} className="sr-only">
          Pilih tanggal grafik
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
              ? `${dayLabel(active.date, true)}, ${active.clicks} klik`
              : 'Belum ada data'
          }
        />
        <details>
          <summary>Lihat data harian</summary>
          <div className="daily-table-wrap">
            <table>
              <caption className="sr-only">Klik harian dalam UTC</caption>
              <thead>
                <tr>
                  <th>Tanggal (UTC)</th>
                  <th>Klik</th>
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
