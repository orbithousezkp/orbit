import React from 'react';
import { principles, currents, horizon } from '../data/forever.js';
import AsciiRule from '../components/AsciiRule.jsx';

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

        <AsciiRule chars={96} />

        <section>
          <h3 className="forever__block-head">the ten currents · capability axes that never end</h3>
          <div className="currents">
            {currents.map((c) => (
              <article className="current" key={c.n}>
                <div className="current__name">·{c.n}· {c.name}</div>
                {c.star && <p className="current__pitch">{c.star}</p>}
                {c.inflight && (
                  <p className="current__inflight">
                    <span className="current__tag">in flight ·</span> {c.inflight}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <AsciiRule chars={96} />

        <section>
          <h3 className="forever__block-head">horizon · phase 10 and beyond</h3>
          <div className="horizon">
            <p>{horizon.blurb}</p>
            <ul className="horizon__list">
              {horizon.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}
