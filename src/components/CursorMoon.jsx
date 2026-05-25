import React, { useEffect, useRef, useState } from 'react';

/**
 * CursorMoon — a soft glowing disc that follows the cursor with a small
 * lag. expands when hovering a link. desktop-only.
 */
export default function CursorMoon() {
  const ref = useRef(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none)').matches || window.innerWidth < 720) {
      setEnabled(false);
      return;
    }

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let raf;
    let isLink = false;

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      const el = e.target;
      const linky = el && (el.closest('a') || el.closest('button'));
      const next = !!linky;
      if (next !== isLink) {
        isLink = next;
        if (ref.current) ref.current.dataset.link = String(isLink);
      }
    };

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      if (ref.current) {
        ref.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  if (!enabled) return null;
  return <div ref={ref} className="moon" data-link="false" aria-hidden="true" />;
}
