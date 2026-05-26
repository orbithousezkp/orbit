import React from 'react';
import { principles, currents, horizon } from '../data/forever.js';

/**
 * Forever — the meta-roadmap on a public surface. Principles never
 * change. Currents deepen forever. The horizon-scanner proposes
 * whatever comes next. Read-only data; no interactions.
 */
export default function Forever() {
  return (
    <section id="forever" className="section section--forever">
      <header className="section__head">
        <div>
          <div className="section__label">forever · the meta-roadmap</div>
          <h2 className="section__title">orbit doesn't end at phase 9.</h2>
        </div>
        <p className="section__lede">
          twelve principles never change. ten currents deepen forever. after the last numbered phase the horizon-scanner proposes whatever comes next. done is never a valid state.
        </p>
      </header>

      <div className="forever">
        <section>
          <h3 className="forever__block-head">immutable principles · only changeable via constitutional amendment</h3>
          <ol className="principles">
            {principles.map((p) => (
              <li className="principle" key={p.n}>
                <div className="principle__num">·{p.n}·</div>
                <div className="principle__name">{p.name}</div>
                <div className="principle__body">{p.body}</div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="forever__block-head">the ten currents · capability axes that never end</h3>
          <div className="currents">
            {currents.map((c) => (
              <article className="current" key={c.n}>
                <div className="current__name">·{c.n}· {c.name}</div>
                <p className="current__pitch">{c.star}</p>
                <p className="current__pitch"><span className="mono">in flight ·</span> {c.inflight}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3 className="forever__block-head">horizon · phase 10 and beyond</h3>
          <div className="horizon">
            <p>{horizon.blurb}</p>
            <ul style={{ margin: '0.8rem 0 0', padding: '0 0 0 1.2rem', fontSize: '0.85rem', color: 'var(--ink-mid)' }}>
              {horizon.bullets.map((b, i) => (
                <li key={i} style={{ marginBottom: '0.3rem' }}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}
