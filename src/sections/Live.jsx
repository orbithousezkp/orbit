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
          the foundation is shipped. memory, permissions, the capability registry, and signed receipts run today — each item below points to the working code path.
        </p>
      </header>

      <div className="caps">
        {capabilities.map((cap) => (
          <article className="cap" key={cap.n}>
            <div className="cap__head">
              <span className="cap__num">·{cap.n}·</span>
              <span className="status-dot" data-status={cap.status} />
            </div>
            <h3 className="cap__name">{cap.name}</h3>
            <code className="cap__path">{cap.path}</code>
            <p className="cap__desc">{cap.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
