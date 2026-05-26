import React, { useState } from 'react';
import { copyToClipboard } from '../lib/format.js';

/**
 * CopyButton — small monospace button. Shows the visible value,
 * copies the full value (often different) on click, and flips to
 * "copied ✓" for 1.2s.
 */
export default function CopyButton({ value, display, label, className = '' }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className={`copy ${className}`}>—</span>;

  const onClick = async (e) => {
    e.preventDefault();
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <button
      type="button"
      className={`copy ${className}`}
      onClick={onClick}
      aria-label={label || `copy ${value}`}
      title={value}
    >
      <span className="copy__value">{display ?? value}</span>
      <span className="copy__hint" aria-hidden="true">
        {copied ? 'copied ✓' : 'copy'}
      </span>
    </button>
  );
}
