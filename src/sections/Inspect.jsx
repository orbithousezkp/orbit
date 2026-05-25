import React, { useEffect, useState } from 'react';

export default function Inspect() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/dashboard.json', { cache: 'no-store', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setData(d))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setErr(e.message);
      });
    return () => ac.abort();
  }, []);

  const approvalMode = data?.walletPolicy?.approvalMode ?? '—';
  const approvalLabel =
    approvalMode && approvalMode !== '—' ? String(approvalMode).replace(/_/g, ' ') : '—';
  const publicViewOnly = data?.walletPolicy?.publicViewOnly ?? true;
  const signer = data?.signer ? `${data.signer.slice(0, 10)}…${data.signer.slice(-6)}` : '—';
  const refusalCount = Array.isArray(data?.refusals) ? data.refusals.length : '—';
  const gitCommit = data?.gitCommit ?? '—';

  return (
    <section id="inspect" className="section section--inspect">
      <header className="section__head">
        <div>
          <div className="section__label">inspect · audit · verify</div>
          <h2 className="section__title">everything is signed.</h2>
        </div>
        <p className="section__lede">
          the ledger is public. clone the verifier, recover the signer yourself, audit the chain end to end. nothing here is told — everything is shown.
        </p>
      </header>

      <div className="inspect">
        <div className="cell">
          <div className="cell__label">approval posture</div>
          <div className="cell__value">{approvalLabel}</div>
          <div className="cell__hint">
            {publicViewOnly ? 'public view only · keys gated' : 'public view only · keys gated'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">signer</div>
          <div className="cell__value mono">{signer}</div>
          <div className="cell__hint">eip-712 · wallet-signed · verifiable</div>
        </div>

        <div className="cell">
          <div className="cell__label">refusals</div>
          <div className="cell__value">{refusalCount}</div>
          <div className="cell__hint">recorded, not silenced</div>
        </div>

        <div className="cell">
          <div className="cell__label">build</div>
          <div className="cell__value mono">{gitCommit}</div>
          <div className="cell__hint">latest signed commit</div>
        </div>

        <a
          className="cell"
          href="https://www.npmjs.com/package/@orbit-house/sdk"
          target="_blank"
          rel="noreferrer"
        >
          <div className="cell__label">sdk</div>
          <div className="cell__value">@orbit-house/sdk</div>
          <div className="cell__hint">projectForDashboard · exportBundle · verifier cli</div>
        </a>

        <a className="cell" href="/dashboard.json" target="_blank" rel="noreferrer">
          <div className="cell__label">snapshot</div>
          <div className="cell__value mono">/dashboard.json</div>
          <div className="cell__hint">
            the raw projection orbit emits{err ? ` · ${err}` : ''}
          </div>
        </a>
      </div>
    </section>
  );
}
