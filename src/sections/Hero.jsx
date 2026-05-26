import React, { useEffect, useRef, useState } from 'react';
import { identity } from '../data/identity.js';
import { timeAgo, truncHash } from '../lib/format.js';
import CopyButton from '../components/CopyButton.jsx';
import Pill from '../components/Pill.jsx';

/**
 * Hero — left column is the brand statement. Right column is a
 * system-status panel pulling real data from /dashboard.json:
 * cycle counter with count-up animation, copy-on-click signer +
 * commit, relative-time "generated", tabular-nums for stable column
 * widths.
 */
export default function Hero() {
  const [data, setData] = useState(null);
  const [cycleDisplay, setCycleDisplay] = useState(0);
  const animFrameRef = useRef(0);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/dashboard.json', { cache: 'no-store', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setData(d))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        console.warn('dashboard.json fetch failed:', e.message);
      });
    return () => {
      ac.abort();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // count-up the cycle number once dashboard.json loads
  useEffect(() => {
    const target = Number(data?.lifecycle?.cycle);
    if (!Number.isFinite(target) || target <= 0) {
      setCycleDisplay(0);
      return;
    }
    const start = performance.now();
    const duration = Math.min(900, 30 * Math.log2(target + 1));
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setCycleDisplay(Math.round(ease(t) * target));
      if (t < 1) animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [data]);

  const cycleStatus = data?.lifecycle?.lastStatus ?? 'idle';
  const gitCommit = data?.gitCommit ?? null;
  const signer = data?.signer ?? null;
  const lastActive = data?.lifecycle?.lastActive ?? data?.generatedAt ?? null;
  const receiptsCount = data?.receipts?.count ?? '—';
  const refusalsCount = Array.isArray(data?.refusals) ? data.refusals.length : '—';
  const adoptersAdopted = data?.adopters?.adopted ?? 0;
  const adoptersTarget = data?.adopters?.phase1Target ?? 5;
  const familyTotal = data?.family?.total ?? null;

  const statusKind = cycleStatus === 'completed' ? 'ok' : cycleStatus === 'running' ? 'next' : 'idle';

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

      <aside className="hero__panel" aria-label="orbit system status">
        <div className="hero__panel-head">
          <span className="hero__panel-label">system</span>
          <Pill status={statusKind}>{cycleStatus}</Pill>
        </div>
        <dl className="hero__panel-list">
          <div className="hero__panel-row">
            <dt>cycle</dt>
            <dd className="mono tnum">#{cycleDisplay}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>commit</dt>
            <dd className="mono">
              {gitCommit ? (
                <CopyButton value={gitCommit} display={truncHash(gitCommit, 7, 0)} label="copy commit" />
              ) : (
                <span>—</span>
              )}
            </dd>
          </div>
          <div className="hero__panel-row">
            <dt>signer</dt>
            <dd className="mono">
              {signer ? (
                <CopyButton value={signer} display={truncHash(signer, 8, 6)} label="copy signer" />
              ) : (
                <span>—</span>
              )}
            </dd>
          </div>
          <div className="hero__panel-row">
            <dt>receipts</dt>
            <dd className="mono tnum">{receiptsCount}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>refusals</dt>
            <dd className="mono tnum">{refusalsCount}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>adopters</dt>
            <dd className="mono tnum">{adoptersAdopted} / {adoptersTarget}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>family</dt>
            <dd className="mono tnum">{familyTotal ?? '—'}</dd>
          </div>
          <div className="hero__panel-row">
            <dt>last cycle</dt>
            <dd className="mono">{timeAgo(lastActive)}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
