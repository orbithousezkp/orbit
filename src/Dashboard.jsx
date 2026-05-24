import { useEffect, useState } from 'react';
import {
  truncateAddress,
  relativeTime,
  nextCycleEstimate,
  formatReceiptBlock,
  formatRefusalRow,
  buildVerifyCommand,
  isBuildStale
} from './dashboard-format.js';
import './dashboard.css';

const DASHBOARD_URL = '/dashboard.json';
const REPO_URL = 'https://github.com/orbit-house/orbit';

export default function Dashboard() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(DASHBOARD_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`http ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setState({ status: 'ready', data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'missing', data: null, error: String(err && err.message || err) });
      });
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'loading') {
    return (
      <main className="dash dash-loading">
        <p className="dash-muted">loading orbit status...</p>
      </main>
    );
  }

  if (state.status === 'missing' || !state.data) {
    return (
      <main className="dash dash-setup">
        <h1 className="dash-wordmark">orbit</h1>
        <p>orbit is in setup. no public cycle data yet.</p>
        <p>
          <a href={REPO_URL}>view repository on github</a>
        </p>
      </main>
    );
  }

  const data = state.data;
  const stale = isBuildStale(data.generatedAt);

  return (
    <main className="dash">
      <Header data={data} />
      <Tagline />
      <Hero data={data} />
      <StatusStrip data={data} />
      <LatestReceipt data={data} />
      <RecentCycles data={data} />
      <RefusalsSection refusals={data.refusals} />
      <Treasury data={data} />
      <BoundariesGrid data={data} />
      <VerifyBlock data={data} />
      <Footer data={data} stale={stale} />
    </main>
  );
}

function Tagline() {
  return (
    <section className="dash-tagline" aria-label="orbit one-liner">
      <p className="dash-tagline-line">
        the control plane for agent memory and infrastructure inside any github repo.
      </p>
      <p className="dash-tagline-sub">
        approval gates, signed cycle proofs, on-chain treasury — built in.
      </p>
    </section>
  );
}

function Header({ data }) {
  const signer = data.signer ? truncateAddress(data.signer) : 'signer pending';
  return (
    <header className="dash-header">
      <div className="dash-header-row">
        <span className="dash-wordmark">orbit</span>
        <span className="dash-cycle">cycle #{data.lifecycle.cycle || 0}</span>
        <span className="dash-signer" title={data.signer || ''}>{signer}</span>
        <a className="dash-link" href={REPO_URL}>github</a>
        <a className="dash-link" href="#brand">household</a>
      </div>
    </header>
  );
}

function Hero({ data }) {
  const lifecycle = data.lifecycle || {};
  const latest = data.receipts && data.receipts.latest;
  const signedReceipt = data.receipts && data.receipts.latestSigned;
  const awake = lifecycle.lastStatus === 'completed' || lifecycle.lastStatus === 'ok';
  const lastSeen = relativeTime(lifecycle.lastActive);
  const nextEta = nextCycleEstimate(lifecycle.lastActive);
  const heading = data.receipts && data.receipts.count > 0
    ? 'orbit is awake.'
    : 'no signed cycles yet - check back.';

  return (
    <section className="dash-hero" id="hero">
      <div className="dash-hero-pulse" aria-hidden="true">
        <span className={awake ? 'dash-pulse dash-pulse-on' : 'dash-pulse'} />
      </div>
      <h1 className="dash-hero-title">{heading}</h1>
      <p className="dash-hero-meta">
        last cycle: <strong>{lastSeen}</strong>
        <span className="dash-sep">|</span>
        next cycle: <strong>{nextEta}</strong>
      </p>
      <p className="dash-hero-cta">
        {signedReceipt
          ? (
            <a className="dash-cta" href={signedReceipt.path ? `${REPO_URL}/blob/main/${signedReceipt.path}` : '#receipt'}>
              signed receipt #{signedReceipt.cycle}
            </a>
          ) : data.signer
            ? <span className="dash-muted">no signed receipt yet</span>
            : <span className="dash-muted">agent signer pending — set ORBIT_AGENT_SIGNER on the repo to enable proof signing</span>}
        {latest && latest.path && (
          <a className="dash-cta dash-cta-secondary" href={`${REPO_URL}/blob/main/${latest.path}`}>view on github</a>
        )}
      </p>
    </section>
  );
}

function StatusStrip({ data }) {
  const lifecycle = data.lifecycle || {};
  const receipts = data.receipts || { list: [] };
  const list = receipts.list || [];
  const refused24h = list.filter((r) => /refus/i.test(r.result || '')).length;
  const tiles = [
    { label: 'cycles run', value: lifecycle.recordedCycles || lifecycle.cycle || 0 },
    { label: 'last status', value: lifecycle.lastStatus || 'unknown' },
    { label: 'refused (recent)', value: refused24h },
    { label: 'signed receipts', value: list.filter((r) => r.signed).length }
  ];
  return (
    <section className="dash-strip" id="status">
      <h2 className="dash-h2">status</h2>
      <ul className="dash-strip-list">
        {tiles.map((tile) => (
          <li key={tile.label} className="dash-tile">
            <span className="dash-tile-value">{tile.value}</span>
            <span className="dash-tile-label">{tile.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LatestReceipt({ data }) {
  const receipts = data.receipts || {};
  const display = receipts.latestSigned || receipts.latest;
  if (!display) {
    return (
      <section className="dash-section" id="receipt">
        <h2 className="dash-h2">latest receipt</h2>
        <p className="dash-muted">no receipts recorded yet.</p>
      </section>
    );
  }
  const block = formatReceiptBlock(display);
  const unsignedNote = receipts.latest && !receipts.latest.signed && receipts.latestSigned
    ? 'newest cycle is unsigned; showing latest signed below.'
    : null;
  return (
    <section className="dash-section" id="receipt">
      <h2 className="dash-h2">latest receipt</h2>
      {unsignedNote && <p className="dash-muted">{unsignedNote}</p>}
      <pre className="dash-receipt">{block}</pre>
    </section>
  );
}

function RecentCycles({ data }) {
  const list = (data.receipts && data.receipts.list) || [];
  if (list.length === 0) {
    return (
      <section className="dash-section" id="cycles">
        <h2 className="dash-h2">recent cycles</h2>
        <p className="dash-muted">no cycles yet.</p>
      </section>
    );
  }
  const rows = [...list].reverse().slice(0, 10);
  return (
    <section className="dash-section" id="cycles">
      <h2 className="dash-h2">recent cycles</h2>
      <table className="dash-table">
        <caption className="dash-table-caption">last {rows.length} cycles, newest first</caption>
        <thead>
          <tr>
            <th scope="col">cycle</th>
            <th scope="col">when</th>
            <th scope="col">trigger</th>
            <th scope="col">steps</th>
            <th scope="col">result</th>
            <th scope="col">receipt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const trig = typeof r.trigger === 'string'
              ? r.trigger
              : r.trigger && typeof r.trigger === 'object'
                ? (r.trigger.type || r.trigger.id || 'unknown')
                : 'unknown';
            return (
              <tr key={r.path || `${r.cycle}-${i}`} className={r.signed ? '' : 'dash-row-unsigned'}>
                <td data-label="cycle">#{r.cycle}</td>
                <td data-label="when">{relativeTime(r.finishedAt || r.startedAt)}</td>
                <td data-label="trigger">{trig}</td>
                <td data-label="steps">{r.totalSteps || 0}</td>
                <td data-label="result">
                  {r.result || '-'}
                  {!r.signed && <span className="dash-badge">unsigned</span>}
                </td>
                <td data-label="receipt">
                  {r.path
                    ? <a className="dash-link" href={`${REPO_URL}/blob/main/${r.path}`}>view</a>
                    : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function RefusalsSection({ refusals }) {
  const list = Array.isArray(refusals) ? refusals : [];
  if (list.length === 0) {
    return (
      <section className="dash-section refusals-section" id="refusals">
        <h2 className="dash-h2">refusals</h2>
        <p className="dash-muted">no refusals in the recent window.</p>
      </section>
    );
  }
  return (
    <section className="dash-section refusals-section" id="refusals">
      <h2 className="dash-h2">refusals</h2>
      <p className="dash-muted">last {list.length}, newest first. each row is a public proof the safety rails held.</p>
      <ul className="refusal-list">
        {list.map((entry, i) => {
          const row = formatRefusalRow(entry);
          return (
            <li key={`${row.cycle}-${i}`} className="refusal-row">
              <span className={`refusal-severity refusal-severity--${row.severity}`} aria-label={`severity ${row.severity}`} />
              <span className={`refusal-badge refusal-badge--${row.category}`}>{row.categoryLabel}</span>
              <span className="refusal-cycle">cycle {row.cycle}</span>
              <span className="refusal-when">{row.when}</span>
              <span className="refusal-summary">{row.summary || 'unsafe action'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Treasury({ data }) {
  const wallet = data.walletPolicy || {};
  const token = wallet.token || {};
  const blocked = (data.permissions && data.permissions.blockedUntilApproved) || [];
  return (
    <section className="dash-section" id="treasury">
      <h2 className="dash-h2">treasury</h2>
      <dl className="dash-dl">
        <div className="dash-dl-row">
          <dt>approval mode</dt>
          <dd>{wallet.approvalMode || 'unknown'}</dd>
        </div>
        <div className="dash-dl-row">
          <dt>public-view only</dt>
          <dd>{wallet.publicViewOnly ? 'yes' : 'no'}</dd>
        </div>
        <div className="dash-dl-row">
          <dt>private keys held</dt>
          <dd>{wallet.noPrivateKeys ? 'none' : 'yes'}</dd>
        </div>
        <div className="dash-dl-row">
          <dt>token</dt>
          <dd>
            {token.symbol ? `${token.name || token.symbol} (${token.symbol})` : 'not configured'}
            {token.launchStatus && <span className="dash-muted"> &middot; {token.launchStatus}</span>}
          </dd>
        </div>
      </dl>
      {blocked.length > 0 && (
        <div className="dash-blocked">
          <h3 className="dash-h3">blocked until approved</h3>
          <ul>
            {blocked.map((item, i) => <li key={i}>{String(item)}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function BoundariesGrid({ data }) {
  const allowed = (data.permissions && data.permissions.allowedWithoutApproval) || [];
  const blocked = (data.permissions && data.permissions.blockedUntilApproved) || [];
  return (
    <section className="dash-section dash-boundaries" id="boundaries">
      <h2 className="dash-h2">what orbit will and will not do</h2>
      <div className="dash-grid-2">
        <div>
          <h3 className="dash-h3">will do without asking</h3>
          {allowed.length === 0
            ? <p className="dash-muted">nothing configured.</p>
            : <ul className="dash-bullet">{allowed.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>}
        </div>
        <div>
          <h3 className="dash-h3">will not do without approval</h3>
          {blocked.length === 0
            ? <p className="dash-muted">nothing currently blocked.</p>
            : <ul className="dash-bullet">{blocked.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>}
        </div>
      </div>
    </section>
  );
}

function VerifyBlock({ data }) {
  const target = (data.receipts && (data.receipts.latestSigned || data.receipts.latest)) || null;
  const command = buildVerifyCommand(target);
  return (
    <section className="dash-section" id="verify">
      <h2 className="dash-h2">verify your own copy</h2>
      <p className="dash-muted">
        prefer a browser? <a href="#inspect">open the proof inspector</a> and paste any cycle proof.
      </p>
      <pre className="dash-cmd">$ npm i -g @orbit-house/verifier
$ {command}</pre>
      {data.signer
        ? <p className="dash-muted">signer hash: <code>{data.signer}</code></p>
        : <p className="dash-muted">agent signer pending. set <code>ORBIT_AGENT_SIGNER</code> on the repo to start publishing signed proofs.</p>}
    </section>
  );
}

function Footer({ data, stale }) {
  return (
    <footer className="dash-footer">
      <ul className="dash-footer-links">
        <li><a href={REPO_URL}>github</a></li>
        <li><a href="https://www.npmjs.com/package/@orbit-house/sdk">npm</a></li>
        <li><a href="#brand">household</a></li>
      </ul>
      <p className="dash-footer-meta">
        built {data.generatedAt ? relativeTime(data.generatedAt) : 'unknown'}
        {data.gitCommit && <span> &middot; commit <code>{data.gitCommit}</code></span>}
        {stale && <span className="dash-stale"> &middot; stale: build older than 2h</span>}
      </p>
    </footer>
  );
}
