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
  const missionsActive = data?.missions?.active ?? '—';
  const missionsTotal = data?.missions?.total ?? null;
  const missionsList = Array.isArray(data?.missions?.list) ? data.missions.list : [];
  const adoptersCount = data?.adopters?.adopted ?? '—';
  const adoptersTarget = data?.adopters?.phase1Target ?? 5;
  const adoptersProgress = typeof data?.adopters?.phase1Progress === 'number'
    ? Math.round(data.adopters.phase1Progress * 100)
    : null;
  const approvalsPending = data?.approvals?.pending ?? null;
  const approvalsTotal = data?.approvals?.total ?? null;
  const approvalsList = Array.isArray(data?.approvals?.list) ? data.approvals.list : [];

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
          <div className="cell__label">missions</div>
          <div className="cell__value">{missionsActive}</div>
          <div className="cell__hint">
            {missionsTotal !== null ? `${missionsTotal} total · open on the board` : 'open on the board'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">adopters</div>
          <div className="cell__value">
            {adoptersCount}{adoptersCount !== '—' ? ` / ${adoptersTarget}` : ''}
          </div>
          <div className="cell__hint">
            {adoptersProgress !== null
              ? `phase 1 target · ${adoptersProgress}%`
              : 'phase 1 target'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">pending approvals</div>
          <div className="cell__value">{approvalsPending ?? '—'}</div>
          <div className="cell__hint">
            {approvalsPending === null
              ? 'projection rebuilds next cycle'
              : approvalsPending === 0
                ? 'nothing waiting on the owner'
                : approvalsTotal !== null
                  ? `${approvalsTotal} total · oldest-first below`
                  : 'oldest-first below'}
          </div>
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

      {missionsList.length > 0 && (
        <div className="inspect__missions">
          <div className="inspect__missions-head">
            <span className="cell__label">open missions</span>
            <span className="cell__hint">labeled orbit:mission · lifted each cycle</span>
          </div>
          <ul className="inspect__missions-list">
            {missionsList.slice(0, 5).map((m) => (
              <li key={m.id || m.issueNumber} className="inspect__mission">
                <a
                  className="inspect__mission-link"
                  href={m.issueUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="inspect__mission-num mono">#{m.issueNumber}</span>
                  <span className="inspect__mission-title">{m.title}</span>
                </a>
                <span className="inspect__mission-meta">
                  by {m.proposer}
                  {m.deadline ? ` · by ${m.deadline}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {approvalsList.length > 0 && (
        <div className="inspect__approvals">
          <div className="inspect__approvals-head">
            <span className="cell__label">stuck approvals</span>
            <span className="cell__hint">oldest first · waiting on the owner</span>
          </div>
          <ul className="inspect__approvals-list">
            {approvalsList.slice(0, 5).map((a) => (
              <li key={a.id || a.issueNumber} className="inspect__approval">
                <a
                  className="inspect__approval-link"
                  href={a.issueUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="inspect__approval-num mono">
                    {a.issueNumber !== null ? `#${a.issueNumber}` : '—'}
                  </span>
                  <span className="inspect__approval-title">
                    {a.category ? a.category.replace(/_/g, ' ') : 'approval'}
                    {a.amount !== null && a.asset
                      ? ` · ${a.amount} ${a.asset}`
                      : a.amount === null && a.category
                        ? ' · amount hidden'
                        : ''}
                  </span>
                </a>
                <span className="inspect__approval-meta">
                  {a.pendingSinceHours !== null
                    ? `pending ${a.pendingSinceHours}h`
                    : 'pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
