// small frontend helpers — pure functions, no React state.

/**
 * Format an ISO timestamp as a relative span ("2h ago", "12d ago").
 * Returns "—" for falsy input. Capped at days; for very old returns
 * the date in YYYY-MM-DD.
 */
export function timeAgo(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return iso.slice(0, 10);
}

/**
 * Truncate a long hash / address to `0xabc…123` form, configurable
 * head/tail length. Returns the raw input if it's shorter than the
 * combined head+tail+ellipsis length.
 */
export function truncHash(value, head = 8, tail = 6) {
  const s = String(value || '');
  if (!s) return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/**
 * Copy text to the clipboard. Resolves to true on success. Uses the
 * async clipboard API when available; falls back to a hidden textarea
 * for older browsers. Never throws.
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(String(text));
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = String(text);
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
