import React, { useEffect, useState } from 'react';
import { timeAgo, truncHash } from '../lib/format.js';
import CopyButton from '../components/CopyButton.jsx';
import Pill from '../components/Pill.jsx';

export default function Inspect() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/dashboard.json', { cache: 'no-store', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setData(d))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        console.warn('dashboard.json fetch failed:', e.message);
        setErr(true);
      });
    return () => ac.abort();
  }, []);

  const approvalMode = data?.walletPolicy?.approvalMode ?? '—';
  const approvalLabel =
    approvalMode && approvalMode !== '—' ? String(approvalMode).replace(/_/g, ' ') : '—';
  const publicViewOnly = data?.walletPolicy?.publicViewOnly ?? true;
  const signer = data?.signer ?? null;
  const refusals = Array.isArray(data?.refusals) ? data.refusals : [];
  const refusalCount = refusals.length;
  const gitCommit = data?.gitCommit ?? null;
  const missionsActive = data?.missions?.active ?? '—';
  const missionsTotal = data?.missions?.total ?? null;
  const adoptersCount = data?.adopters?.adopted ?? '—';
  const adoptersTarget = data?.adopters?.phase1Target ?? 5;
  const adoptersProgress =
    typeof data?.adopters?.phase1Progress === 'number'
      ? Math.round(data.adopters.phase1Progress * 100)
      : null;
  const approvalsPending = data?.approvals?.pending ?? null;
  const approvalsTotal = data?.approvals?.total ?? null;
  const horizonDryRun = data?.horizon?.dryRun;
  const horizonEnabledSources = data?.horizon?.enabledSources ?? null;
  const horizonTotalSources = data?.horizon?.totalSources ?? null;
  const horizonPending = data?.horizon?.pending ?? null;
  const handoffTotal = data?.handoff?.total ?? null;
  const handoffMostRecent = data?.handoff?.mostRecent ?? null;
  const errorsTotal = data?.errors?.total ?? null;
  const errorsRecent = Array.isArray(data?.errors?.recent) ? data.errors.recent : [];
  const receipts = Array.isArray(data?.receipts?.list) ? data.receipts.list : [];
  const lastActive = data?.lifecycle?.lastActive ?? data?.generatedAt ?? null;

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
            {publicViewOnly
              ? 'public view only · keys gated'
              : 'gated · approval-issue required for external spend'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">signer</div>
          <div className="cell__value mono">
            {signer ? (
              <CopyButton value={signer} display={truncHash(signer, 8, 6)} label="copy signer" />
            ) : (
              '—'
            )}
          </div>
          <div className="cell__hint">eip-712 · wallet-signed · verifiable</div>
        </div>

        <div className="cell">
          <div className="cell__label">refusals</div>
          <div className="cell__value tnum">{refusalCount}</div>
          <div className="cell__hint">recorded, not silenced</div>
        </div>

        <div className="cell">
          <div className="cell__label">missions</div>
          <div className="cell__value tnum">{missionsActive}</div>
          <div className="cell__hint">
            {missionsTotal !== null ? `${missionsTotal} total · open on the board` : 'open on the board'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">adopters</div>
          <div className="cell__value tnum">
            {adoptersCount}
            {adoptersCount !== '—' ? ` / ${adoptersTarget}` : ''}
          </div>
          <div className="cell__hint">
            {adoptersProgress !== null
              ? `phase 1 target · ${adoptersProgress}%`
              : 'phase 1 target'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">pending approvals</div>
          <div className="cell__value tnum">{approvalsPending ?? '—'}</div>
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
          <div className="cell__label">horizon scanner</div>
          <div className="cell__value tnum">
            {horizonEnabledSources === null
              ? '—'
              : `${horizonEnabledSources}${horizonTotalSources !== null ? `/${horizonTotalSources}` : ''}`}
          </div>
          <div className="cell__hint">
            {horizonEnabledSources === null
              ? 'projection rebuilds next cycle'
              : horizonDryRun
              ? `dry-run · ${horizonPending ?? 0} candidate${(horizonPending ?? 0) === 1 ? '' : 's'} pending`
              : `live · ${horizonPending ?? 0} candidate${(horizonPending ?? 0) === 1 ? '' : 's'} pending`}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">handoff</div>
          <div className="cell__value tnum">{handoffTotal ?? '—'}</div>
          <div className="cell__hint">
            {handoffTotal === null
              ? 'projection rebuilds next cycle'
              : handoffTotal === 0
              ? 'no founder-handoff proposed'
              : handoffMostRecent
              ? `${handoffMostRecent.id} · ${handoffMostRecent.status}`
              : 'see memory/handoff.json'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">recent errors</div>
          <div className="cell__value tnum">{errorsTotal ?? '—'}</div>
          <div className="cell__hint">
            {errorsTotal === null
              ? 'projection rebuilds next cycle'
              : errorsTotal === 0
              ? 'clean log · nothing logged'
              : errorsRecent[0]
              ? `last: ${errorsRecent[0].phase}${errorsRecent[0].tool ? ' / ' + errorsRecent[0].tool : ''}`
              : 'see memory/errors.jsonl'}
          </div>
        </div>

        <div className="cell">
          <div className="cell__label">last cycle</div>
          <div className="cell__value mono">{timeAgo(lastActive)}</div>
          <div className="cell__hint">{lastActive ? lastActive.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : '—'}</div>
        </div>

        <div className="cell">
          <div className="cell__label">build</div>
          <div className="cell__value mono">
            {gitCommit ? (
              <CopyButton value={gitCommit} display={truncHash(gitCommit, 7, 0)} label="copy commit" />
            ) : (
              '—'
            )}
          </div>
          <div className="cell__hint">latest signed commit</div>
        </div>

        <a
          className="cell"
          href="https://www.npmjs.com/package/@orbit-house/sdk"
          target="_blank"
          rel="noreferrer noopener"
        >
          <div className="cell__label">sdk</div>
          <div className="cell__value">@orbit-house/sdk</div>
          <div className="cell__hint">projectForDashboard · exportBundle · verifier cli</div>
        </a>

        <a
          className="cell"
          href="/dashboard.json"
          target="_blank"
          rel="noreferrer noopener"
        >
          <div className="cell__label">snapshot</div>
          <div className="cell__value mono">/dashboard.json</div>
          <div className="cell__hint">
            {err ? 'data unavailable · retry shortly' : 'the raw projection orbit emits'}
          </div>
        </a>
      </div>

      {receipts.length > 0 && (
        <div className="inspect__table-block">
          <div className="inspect__table-head">
            <span className="cell__label">recent receipts</span>
            <span className="cell__hint">{receipts.length} of {data?.receipts?.count ?? '?'} · newest first</span>
          </div>
          <table className="table" aria-label="recent receipts">
            <thead>
              <tr>
                <th style={{ width: '4rem' }}>cycle</th>
                <th style={{ width: '7rem' }}>signed</th>
                <th>result</th>
                <th style={{ width: '4rem', textAlign: 'right' }}>files</th>
                <th style={{ width: '6rem' }}>time</th>
              </tr>
            </thead>
            <tbody>
              {receipts.slice(0, 10).map((r, i) => (
                <tr key={r.cycle ?? i} data-flag={r.signed ? 'signed' : ''}>
                  <td className="table__num">#{r.cycle ?? '?'}</td>
                  <td>
                    {r.signed ? (
                      <Pill status="ok">signed</Pill>
                    ) : (
                      <Pill status="future">unsigned</Pill>
                    )}
                  </td>
                  <td>{r.result || '—'}</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{r.filesChangedCount ?? '—'}</td>
                  <td>{timeAgo(r.finishedAt || r.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refusals.length > 0 && (
        <div className="inspect__table-block">
          <div className="inspect__table-head">
            <span className="cell__label">recent refusals</span>
            <span className="cell__hint">{refusals.length} recorded · public, not silenced</span>
          </div>
          <table className="table" aria-label="recent refusals">
            <thead>
              <tr>
                <th style={{ width: '4rem' }}>cycle</th>
                <th style={{ width: '8rem' }}>category</th>
                <th>reason</th>
                <th style={{ width: '6rem' }}>time</th>
              </tr>
            </thead>
            <tbody>
              {refusals.slice(0, 8).map((r, i) => (
                <tr key={i} data-flag="refused">
                  <td className="table__num">#{r.cycle ?? '?'}</td>
                  <td>{r.category || r.risk?.category || '—'}</td>
                  <td>{r.reason || r.refusalReason || '—'}</td>
                  <td>{timeAgo(r.finishedAt || r.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
