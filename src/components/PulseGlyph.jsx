import React, { useEffect, useRef } from 'react';

/**
 * PulseGlyph — a quiet canvas glyph: outer dashed ring, soft halo,
 * inner luminous sweep, warm dot riding the arc's end. one revolution
 * roughly every 24 seconds. purely visual, no labels.
 */
export default function PulseGlyph({ size = 280 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.46;
    const innerR = size * 0.34;
    const haloR = size * 0.48;

    let raf;
    const period = 24000; // ms per revolution

    const render = () => {
      const t = performance.now();
      const angle = ((t % period) / period) * Math.PI * 2;

      ctx.clearRect(0, 0, size, size);

      // halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      halo.addColorStop(0, 'rgba(251, 217, 160, 0.22)');
      halo.addColorStop(0.55, 'rgba(251, 217, 160, 0.08)');
      halo.addColorStop(1, 'rgba(251, 217, 160, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // outer dashed ring
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(10, 31, 58, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // inner luminous arc sweep (about 210deg, ending at angle)
      const sweep = Math.PI * 1.16;
      const start = angle - sweep;
      const grad = ctx.createLinearGradient(
        cx + Math.cos(start) * innerR,
        cy + Math.sin(start) * innerR,
        cx + Math.cos(angle) * innerR,
        cy + Math.sin(angle) * innerR,
      );
      grad.addColorStop(0, 'rgba(124, 214, 255, 0.6)');
      grad.addColorStop(1, 'rgba(245, 169, 107, 0.85)');
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, start, angle);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();

      // warm orbiting dot at the arc's end
      const dx = cx + Math.cos(angle) * innerR;
      const dy = cy + Math.sin(angle) * innerR;
      const dotR = size * 0.022;
      const dotGlow = ctx.createRadialGradient(dx, dy, 0, dx, dy, dotR * 4);
      dotGlow.addColorStop(0, 'rgba(251, 217, 160, 0.9)');
      dotGlow.addColorStop(1, 'rgba(251, 217, 160, 0)');
      ctx.fillStyle = dotGlow;
      ctx.beginPath();
      ctx.arc(dx, dy, dotR * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [size]);

  return (
    <canvas
      ref={ref}
      style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
      aria-hidden="true"
    />
  );
}
