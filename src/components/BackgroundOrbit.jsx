import React, { useEffect, useRef } from 'react';

/**
 * BackgroundOrbit — ambient orbit motif rendered behind every section.
 * 7 concentric rings centered off-axis, each drifting at its own rate
 * with a soft planet riding its phase. one warm dot accents the system;
 * the rest are skyblue. opacity is owned by the .bg-orbit class.
 */
export default function BackgroundOrbit() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const setup = () => {
      dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    setup();

    const RINGS = 7;
    // pick one ring to host the warm dot
    const warmRing = 2;

    let raf;
    const render = () => {
      const t = performance.now() / 1000;

      const cx = w * 0.65;
      const cy = h * 0.38;
      const maxR = Math.max(w, h) * 0.78;
      const minR = Math.min(w, h) * 0.10;

      ctx.clearRect(0, 0, w, h);

      // soft warm sun at the center
      const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, minR * 1.4);
      sun.addColorStop(0, 'rgba(251, 217, 160, 0.42)');
      sun.addColorStop(0.6, 'rgba(251, 217, 160, 0.10)');
      sun.addColorStop(1, 'rgba(251, 217, 160, 0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(cx, cy, minR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < RINGS; i++) {
        const k = i / (RINGS - 1);
        const r = minR + (maxR - minR) * (0.16 + k * 0.84);

        // ring color shifts skyblue across radii
        const a = 0.10 + (1 - k) * 0.08;
        const blue = 0.10 + k * 0.08; // hue progression
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = i === warmRing
          ? `rgba(74, 144, 226, ${a})`
          : `rgba(124, 214, 255, ${blue + 0.04})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.stroke();
        ctx.setLineDash([]);

        // planet on each ring — outer rings drift slower, alternating directions
        const speed = 0.045 / (1 + i * 0.42);
        const offset = i * Math.PI * 2 * 0.137;
        const dir = i % 2 === 0 ? 1 : -1;
        const angle = t * speed * dir + offset;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;

        if (i === warmRing) {
          const warmR = 6.5;
          const g = ctx.createRadialGradient(px, py, 0, px, py, warmR * 3.4);
          g.addColorStop(0, 'rgba(251, 217, 160, 0.85)');
          g.addColorStop(0.4, 'rgba(245, 169, 107, 0.35)');
          g.addColorStop(1, 'rgba(245, 169, 107, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, warmR * 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fbd9a0';
          ctx.beginPath();
          ctx.arc(px, py, warmR * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const cool = 5 + (1 - k) * 2;
          const g = ctx.createRadialGradient(px, py, 0, px, py, cool * 3);
          g.addColorStop(0, 'rgba(181, 227, 255, 0.65)');
          g.addColorStop(0.5, 'rgba(124, 214, 255, 0.22)');
          g.addColorStop(1, 'rgba(124, 214, 255, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, cool * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(74, 144, 226, 0.55)';
          ctx.beginPath();
          ctx.arc(px, py, cool * 0.45, 0, Math.PI * 2);
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
  }, []);

  return <canvas ref={ref} className="bg-orbit" aria-hidden="true" />;
}
