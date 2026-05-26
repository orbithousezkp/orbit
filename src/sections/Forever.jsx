import React from 'react';
import { principles, currents, horizon } from '../data/forever.js';

/**
 * Forever — the meta-roadmap on a public surface. principles never change,
 * currents deepen forever, the horizon-scanner proposes whatever comes next.
 * see PLAN/FOREVER_ROADMAP.md for the prose version.
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

      <div className="forever__group">
        <div className="forever__group-head">
          <span className="cell__label">immutable principles</span>
          <span className="cell__hint">survive every phase transition · only changeable via constitutional amendment</span>
        </div>
        <div className="forever__principles">
          {principles.map((p) => (
            <article className="principle" key={p.n}>
              <div className="principle__num">·{p.n}·</div>
              <h3 className="principle__name">{p.name}</h3>
              <p className="principle__body">{p.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="forever__group">
        <div className="forever__group-head">
          <span className="cell__label">the ten currents</span>
          <span className="cell__hint">capability axes that never end · each runs across every phase</span>
        </div>
        <div className="forever__currents">
          {currents.map((c) => (
            <article className="current" key={c.n}>
              <div className="current__head">
                <span className="current__num mono">·{c.n}·</span>
                <h3 className="current__name">{c.name}</h3>
              </div>
              <p className="current__star">{c.star}</p>
              <p className="current__inflight"><span className="current__tag">in flight ·</span> {c.inflight}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="forever__group">
        <div className="forever__group-head">
          <span className="cell__label">horizon · phase 10 and beyond</span>
          <span className="cell__hint">the engine that makes the roadmap self-extending</span>
        </div>
        <div className="forever__horizon">
          <p className="forever__horizon-blurb">{horizon.blurb}</p>
          <ul className="forever__horizon-list">
            {horizon.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
