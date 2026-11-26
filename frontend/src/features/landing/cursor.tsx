'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE = 'a, button, [data-cursor="hover"]';

/**
 * Custom cursor (dot + trailing ring) and the pointer position used by the
 * landing spotlight. Only enabled for fine pointers; touch keeps the default.
 */
export function LandingCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const root = document.documentElement;
    root.classList.add('has-custom-cursor');
    const target = { x: -100, y: -100 };
    const current = { x: -100, y: -100 };
    let frame = 0;
    const tick = () => {
      const ease = reduced ? 1 : 0.18;
      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;
      ring.current?.style.setProperty(
        'translate',
        `${current.x}px ${current.y}px`,
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const move = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      dot.current?.style.setProperty(
        'translate',
        `${event.clientX}px ${event.clientY}px`,
      );
      root.style.setProperty('--mx', `${event.clientX}px`);
      root.style.setProperty('--my', `${event.clientY}px`);
      const hovering =
        event.target instanceof Element && event.target.closest(INTERACTIVE);
      root.classList.toggle('cursor-hover', Boolean(hovering));
      root.classList.add('cursor-visible');
    };
    const leave = () => root.classList.remove('cursor-visible');
    const down = () => root.classList.add('cursor-down');
    const up = () => root.classList.remove('cursor-down');
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      root.classList.remove(
        'has-custom-cursor',
        'cursor-visible',
        'cursor-hover',
        'cursor-down',
      );
      root.style.removeProperty('--mx');
      root.style.removeProperty('--my');
    };
  }, []);
  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden="true">
        <span />
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
