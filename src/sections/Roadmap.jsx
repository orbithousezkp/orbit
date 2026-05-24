import React, { useRef, useState } from 'react';
import { phases } from '../data/phases.js';
import OrbitalMap from '../components/OrbitalMap.jsx';

export default function Roadmap() {
  const [active, setActive] = useState(0);
  const itemRefs = useRef([]);

  const onKeyDown = (e, i) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = itemRefs.current[Math.min(i + 1, phases.length - 1)];
      next && next.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = itemRefs.current[Math.max(i - 1, 0)];
      prev && prev.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = itemRefs.current[0];
      first && first.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = itemRefs.current[phases.length - 1];
      last && last.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActive(i);
    }
  };

  const phase = phases[active];

  return (
    <section id="roadmap" className="section section--roadmap">
      <header className="section__head">
        <div>
          <div className="section__label">phases · 01 → 07</div>
          <h2 className="section__title">the trajectory.</h2>
        </div>
        <p className="section__lede">
          seven phases. live today, with the network expanding from five hundred adopter repositories to twenty-five thousand and beyond — across github, the developer toolchain, and on-chain accountability.
        </p>
      </header>

      <div className="roadmap">
        <div className="roadmap__map">
          <OrbitalMap activeIndex={active} count={phases.length} />
        </div>

        <ul className="roadmap__rail">
          {phases.map((p, i) => (
            <li
              key={p.n}
              ref={(el) => (itemRefs.current[i] = el)}
              className="rail__item"
              data-active={String(active === i)}
              data-status={p.status}
              tabIndex={0}
              role="button"
              aria-pressed={active === i}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="rail__dot" />
              <div>
                <div className="rail__num">·{p.n}·</div>
                <div className="rail__name">{p.name}</div>
              </div>
              <span className="rail__scale">{p.scale}</span>
            </li>
          ))}
        </ul>

        <div className="phase-detail">
          <div className="phase-detail__head">
            <span className="phase-detail__num">·{phase.n}·</span>
            <h3 className="phase-detail__name">{phase.name}</h3>
            <span className="phase-detail__scale" data-status={phase.status}>{phase.scale}</span>
          </div>
          <p className="phase-detail__pitch">{phase.pitch}</p>
          <ul className="phase-detail__bullets">
            {phase.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
