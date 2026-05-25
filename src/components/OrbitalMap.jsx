import React, { useEffect, useRef } from 'react';

/**
 * OrbitalMap — concentric rings on a light field. each phase is a planet
 * riding its ring. the active ring is warm and solid; inactive rings are
 * dim ink dashed. no text on the canvas — labels live elsewhere.
 */
export default function OrbitalMap({ activeIndex = 0, count = 7 }) {
  const ref = useRef(null);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;
    let w = canvas.clientWidth;
    let h = canvas.clientHeight;

    const setup = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    setup();

    let raf;
    const render = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;

      w = canvas.clientWidth;
      h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.46;
      const minR = Math.min(w, h) * 0.08;

      // soft warm sun
      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, minR * 1.2);
      sunGrad.addColorStop(0, 'rgba(251, 217, 160, 0.65)');
      sunGrad.addColorStop(0.55, 'rgba(245, 169, 107, 0.22)');
      sunGrad.addColorStop(1, 'rgba(245, 169, 107, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, minR * 1.2, 0, Math.PI * 2);
      ctx.fill();

      const denom = Math.max(count - 1, 1);
      for (let i = 0; i < count; i++) {
        const t = i / denom;
        const r = minR + (maxR - minR) * (0.18 + t * 0.82);
        const isActive = i === activeIndex;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (isActive) {
          ctx.strokeStyle = 'rgba(245, 169, 107, 0.7)';
          ctx.setLineDash([]);
          ctx.lineWidth = 1.4;
        } else {
          ctx.strokeStyle = `rgba(10, 31, 58, ${0.08 + (1 - t) * 0.06})`;
          ctx.setLineDash([2, 6]);
          ctx.lineWidth = 1;
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const speed = 0.06 / (1 + i * 0.5);
        const baseAngle = elapsed * speed * (i % 2 === 0 ? 1 : -1);
        const offset = i * Math.PI * 2 * 0.137;
        const angle = baseAngle + offset;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;

        if (isActive) {
          const pulse = 1 + Math.sin(elapsed * 1.6) * 0.18;
          const radius = 9 * pulse;
          const g = ctx.createRadialGradient(px, py, 0, px, py, radius * 3);
          g.addColorStop(0, '#fffaf0');
          g.addColorStop(0.3, '#fbd9a0');
          g.addColorStop(1, 'rgba(245, 169, 107, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, radius * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fffaf0';
          ctx.beginPath();
          ctx.arc(px, py, radius * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const dim = i < activeIndex ? 0.7 : 0.4;
          const radius = i < activeIndex ? 5 : 4;
          const g = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.5);
          g.addColorStop(0, `rgba(124, 214, 255, ${dim})`);
          g.addColorStop(1, 'rgba(124, 214, 255, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(45, 90, 140, ${dim + 0.15})`;
          ctx.beginPath();
          ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onResize = () => setup();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [activeIndex, count]);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
    />
  );
}
