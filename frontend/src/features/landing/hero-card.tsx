'use client';

import { useI18n } from '@/lib/use-i18n';
import { useRef, useState } from 'react';
import { Icon } from '@/components/icons';

const days = [12, 19, 15, 27, 22, 17, 31, 26, 36, 29, 41, 35, 47, 86];
const top = Math.max(...days);

export function HeroCard() {
  const card = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(days.length - 1);
  const { t } = useI18n();
  function tilt(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !card.current) return;
    const box = card.current.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    card.current.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
    card.current.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
    card.current.style.setProperty('--gx', `${x * 100}%`);
    card.current.style.setProperty('--gy', `${y * 100}%`);
  }
  function reset() {
    card.current?.style.setProperty('--rx', '0deg');
    card.current?.style.setProperty('--ry', '0deg');
    setActive(days.length - 1);
  }
  const ago = days.length - 1 - active;
  const label =
    ago === 0
      ? t('Hari ini', 'Today')
      : t(`${ago} hari lalu`, `${ago} ${ago === 1 ? 'day' : 'days'} ago`);
  return (
    <div className="hero-stage">
      <div
        ref={card}
        className="hero-card"
        onPointerMove={tilt}
        onPointerLeave={reset}
        aria-hidden="true"
      >
        <div className="hero-field">
          https://toko-kamu.id/koleksi/musim-hujan-2026?utm_source=instagram
        </div>
        <div className="hero-arrow">
          <Icon name="arrow" width={16} />
        </div>
        <div className="hero-field is-short">
          jadi.click/<b>hujan26</b>
        </div>
        <div className="hero-stats">
          <div>
            <span>{t('Klik', 'Clicks')}</span>
            <strong>1.284</strong>
          </div>
          <div>
            <span>{t('Negara', 'Countries')}</span>
            <strong>12</strong>
          </div>
          <div>
            <span>{label}</span>
            <strong key={active} className="hero-count">
              {days[active]}
            </strong>
          </div>
        </div>
        <div className="hero-bars">
          {days.map((value, index) => (
            <i
              key={index}
              data-cursor="hover"
              className={index === active ? 'is-active' : ''}
              onPointerEnter={() => setActive(index)}
              style={{
                height: `${(value / top) * 100}%`,
                animationDelay: `${450 + index * 35}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
