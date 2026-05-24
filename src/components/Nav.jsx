import React from 'react';

/**
 * Nav — persistent top bar. brand on the left, four route links on the right.
 * `active` flags the current section so CSS can underline it.
 */
export default function Nav({ active }) {
  return (
    <nav className="nav" aria-label="primary">
      <a href="/" data-path="/" className="nav__brand">
        orbit<sub>·house</sub>
      </a>
      <div className="nav__links">
        <a href="/" data-path="/" data-active={String(active === 'home')}>home</a>
        <a href="/live" data-path="/live" data-active={String(active === 'live')}>live</a>
        <a href="/roadmap" data-path="/roadmap" data-active={String(active === 'roadmap')}>roadmap</a>
        <a href="/inspect" data-path="/inspect" data-active={String(active === 'inspect')}>inspect</a>
      </div>
    </nav>
  );
}
