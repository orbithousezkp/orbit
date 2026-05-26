import React from 'react';

/**
 * AsciiRule — a thin terminal-style horizontal rule. Renders as a
 * row of "─" characters in monospace; the line breaks gracefully at
 * narrow widths. Decorative; aria-hidden.
 */
export default function AsciiRule({ chars = 64, className = '' }) {
  return (
    <div className={`ascii-rule ${className}`} aria-hidden="true">
      {'─'.repeat(chars)}
    </div>
  );
}
