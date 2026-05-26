import React, { useEffect, useState } from 'react';
import { identity } from '../data/identity.js';

/**
 * Hero — left column is the brand statement.
 * Right column is a system-status panel: real dashboard.json data
 * surfaced as a tech-rich code-block readout. No decorative glyph.
 */
export default function Hero() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/dashboard.json', { cache: 'no-store', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setData(d))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        console.warn('dashboard.json fetch failed:', e.message);
      });
    return () => ac.abort();
  }, []);

  const cycle = data?.lifecycle?.cycle ?? '—';
  const cycleStatus = data?.lifecycle?.lastStatus ?? '—';
  const gitCommit = data?.gitCommit ?? '—';
  const signer = data?.signer
    ? `${data.signer.slice(0, 10)}…${data.signer.slice(-6)}`
    : '—';
  const generatedAt = data?.generatedAt
    ? data.generatedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
    : '—';
  const receiptsCount = data?.receipts?.count ?? '—';
  const refusalsCount = Array.isArray(data?.refusals) ? data.refusals.length : '—';

  return (
    <section id="home" className="section hero">
      <div className="hero__col-text">
        <h1 className="hero__brand">orbit</h1>
        <p className="hero__tagline">
          the control plane for agent memory and infrastructure inside any github repository.
        </p>
        <p className="hero__desc">{identity.description}</p>
        <p className="hero__motto">built to outlive its founder.</p>
        <div className="hero__chips">
          <span className="chip">memory</span>
          <span className="chip">permissions</span>
          <span className="chip">capabilities</span>
          <span className="chip">receipts</span>
        </div>
      </div>

      <aside className="hero__panel">
        <div className="hero__panel-head">
          <span className="hero__panel-label">system</span>
          <span className="hero__panel-status">
            <span className="status-dot" data-status={cycleStatus === 'completed' ? 'ok' : 'idle'} />
            {cycleStatus}
          </span>
        </div>
        <dl className="hero__panel-list">
          <div className="hero__panel-row">
            <dt>cycle</dt>
            <dd className="mono">#{cycle}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>commit</dt>
            <dd className="mono">{gitCommit}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>signer</dt>
            <dd className="mono">{signer}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>receipts</dt>
            <dd className="mono">{receiptsCount}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>refusals</dt>
            <dd className="mono">{refusalsCount}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>generated</dt>
            <dd className="mono">{generatedAt}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
