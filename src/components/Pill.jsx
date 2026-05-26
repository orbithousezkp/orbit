import React from 'react';

/**
 * Pill — small status badge with semantic data-status: ok | live |
 * next | gated | future | idle | warn | danger. Plain text or with
 * a leading dot.
 */
export default function Pill({ status = 'idle', dot = true, children, className = '' }) {
  return (
    <span className={`pill ${className}`} data-status={status}>
      {dot && <span className="pill__dot" aria-hidden="true" />}
      <span className="pill__text">{children}</span>
    </span>
  );
}
