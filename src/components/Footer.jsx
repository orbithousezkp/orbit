import React from 'react';
import { identity } from '../data/identity.js';
import CAPlaceholder from './CAPlaceholder.jsx';

/**
 * Footer — persistent across every route. ca slot on the left,
 * motto in the middle, outbound waypoints on the right.
 */
export default function Footer() {
  return (
    <footer className="footer">
      <CAPlaceholder />
      <span className="footer__motto">memory · permissions · proof</span>
      <div className="footer__waypoints">
        <a className="waypoint" href={identity.links.farcaster} target="_blank" rel="noreferrer">
          <span className="waypoint__dot" /><span>farcaster</span>
        </a>
        <a className="waypoint" href={identity.links.github} target="_blank" rel="noreferrer">
          <span className="waypoint__dot" /><span>github</span>
        </a>
      </div>
    </footer>
  );
}
