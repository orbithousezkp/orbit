import React, { useEffect, useRef, useState } from 'react';
import { identity } from '../data/identity.js';

/**
 * CAPlaceholder — contract address slot. shows a truncated address when
 * VITE_ORBIT_CA is set, otherwise a dashed placeholder. clicking copy
 * writes the full value (or a "forthcoming" string) to the clipboard.
 */
export default function CAPlaceholder() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const ca = (identity.ca || '').trim();
  const hasAddress = ca.length >= 6;
  const shortPlaceholder = '0x————————';
  const shown = hasAddress ? `${ca.slice(0, 6)}…${ca.slice(-4)}` : shortPlaceholder;
  const title = hasAddress ? ca : 'address forthcoming';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = () => {
    const value = hasAddress ? ca : '<address forthcoming>';
    try {
      const result = navigator.clipboard && navigator.clipboard.writeText(value);
      if (result && typeof result.then === 'function') {
        result
          .then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => {});
      }
    } catch {
      // silently no-op
    }
  };

  return (
    <div className="ca">
      <span className="ca__label">ca</span>
      <span className="ca__addr" title={title}>{shown}</span>
      <button
        className="ca__copy"
        data-copied={String(copied)}
        onClick={handleCopy}
        type="button"
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  );
}
