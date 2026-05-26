import React from 'react';
import { identity } from '../data/identity.js';
import CAPlaceholder from './CAPlaceholder.jsx';

/**
 * Footer — persistent across every route. ca slot on the left,
 * motto in the middle, outbound waypoints on the right. Maker
 * credit sits beneath the row on its own line so it never crowds
 * the dot navigation but is always present.
 */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__row">
        <CAPlaceholder />
        <span className="footer__motto">memory · permissions · proof</span>
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
