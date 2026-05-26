import React from 'react';
import { phases } from '../data/phases.js';

/**
 * Roadmap — every phase rendered in full, vertically stacked. No
 * clickable rail, no decorative orbital map. The data is the surface.
 */
export default function Roadmap() {
  return (
    <section id="roadmap" className="section section--roadmap">
      <header className="section__head">
        <div>
          <div className="section__label">phases · 01 → {phases[phases.length - 1].n}</div>
          <h2 className="section__title">the trajectory.</h2>
        </div>
        <p className="section__lede">
          numbered phases gate progress; each phase exits only when its concrete deliverables ship. after phase nine the horizon-scanner proposes whatever comes next.
        </p>
      </header>

      <ol className="phases">
        {phases.map((p) => (
          <li key={p.n} className="phase" data-status={p.status}>
            <header className="phase__head">
              <span className="phase__num mono">·{p.n}·</span>
              <h3 className="phase__name">{p.name}</h3>
              <span className="phase__scale" data-status={p.status}>{p.scale}</span>
            </header>
            <p className="phase__pitch">{p.pitch}</p>
            {Array.isArray(p.bullets) && p.bullets.length > 0 && (
              <ul className="phase__bullets">
                {p.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
