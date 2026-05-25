import React from 'react';
import { capabilities } from '../data/capabilities.js';

export default function Live() {
  return (
    <section id="live" className="section section--live">
      <header className="section__head">
        <div>
          <div className="section__label">phase 01 · live</div>
          <h2 className="section__title">what's running.</h2>
        </div>
        <p className="section__lede">
          the foundation is shipped. memory, permissions, the capability registry, and signed receipts run today — each item below points to working code.
        </p>
      </header>

      <div className="caps">
        {capabilities.map((cap) => (
          <article className="cap" key={cap.n}>
            <div className="cap__num">·{cap.n}·</div>
            <h3 className="cap__name">{cap.name}</h3>
            <p className="cap__desc">{cap.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
