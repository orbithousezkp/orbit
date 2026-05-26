import React, { useEffect, useState } from 'react';
import { identity } from '../data/identity.js';
import { copyToClipboard, timeAgo, truncHash } from '../lib/format.js';
import CAPlaceholder from './CAPlaceholder.jsx';

/**
 * Footer — persistent across every route.
 * Row 1: CA + npm install terminal-CTA + outbound waypoints.
 * Row 2: build-status line (main · sha · cycle #N · Xh ago).
 * Row 3: maker credit.
 */
export default function Footer() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/dashboard.json', { cache: 'no-store', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setData(d))
      .catch((e) => {
        if (e.name === 'AbortError') return;
      });
    return () => ac.abort();
  }, []);

  const installCmd = 'npm install @orbit-house/sdk';
  const gitCommit = data?.gitCommit ?? null;
  const cycle = data?.lifecycle?.cycle ?? null;
  const lastActive = data?.lifecycle?.lastActive ?? data?.generatedAt ?? null;

  const onCopyInstall = async () => {
    const ok = await copyToClipboard(installCmd);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <footer className="footer">
      <div className="footer__row">
        <CAPlaceholder />
        <button type="button" className="term" onClick={onCopyInstall} aria-label="copy npm install command">
          <span className="term__prompt">$</span>
          <span className="term__cmd">{installCmd}</span>
          <span className="term__copy">{copied ? 'copied' : 'copy'}</span>
        </button>
        <div className="footer__waypoints">
          <a
            className="waypoint"
            href={identity.links.farcaster}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span className="waypoint__dot" /><span>farcaster</span>
          </a>
          <a
            className="waypoint"
            href={identity.links.github}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span className="waypoint__dot" /><span>github</span>
          </a>
        </div>
      </div>

      <div className="footer__build" aria-label="build status">
        <span className="footer__build-branch">main</span>
        <span className="footer__build-sep">·</span>
        <span className="mono">{gitCommit ? truncHash(gitCommit, 7, 0) : '—'}</span>
        <span className="footer__build-sep">·</span>
        <span className="mono">cycle {cycle != null ? `#${cycle}` : '—'}</span>
        <span className="footer__build-sep">·</span>
        <span className="mono">{timeAgo(lastActive)}</span>
      </div>

      <p className="footer__credit">
        made by <a
          className="footer__credit-link"
          href="https://x.com/cryptoasuran"
          target="_blank"
          rel="noreferrer noopener"
        >cryptoasuran</a>
      </p>
    </footer>
  );
}
