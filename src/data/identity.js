/**
 * single source for brand + outbound links. all major links flow from
 * import.meta.env so the site reads .env (or GitHub Actions env at build
 * time) instead of hardcoding them.
 *
 * VITE_ORBIT_CA      — contract address placeholder; copy-able when set
 * VITE_ORBIT_GITHUB_URL    — github organisation/profile
 * VITE_ORBIT_FARCASTER_URL — farcaster profile
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const identity = {
  brand: 'orbit',
  tagline: 'the agent memory and infrastructure layer for github repositories.',
  description:
    'orbit turns a github repo into an operating surface. memory, permissions, capabilities, and proof receipts — versioned files, native to the repo, signed every cycle.',
  links: {
    github: env.VITE_ORBIT_GITHUB_URL || 'https://github.com/orbit-house',
    farcaster: env.VITE_ORBIT_FARCASTER_URL || 'https://warpcast.com/orbit-house',
  },
  ca: (env.VITE_ORBIT_CA || '').trim(),
};

export const caPlaceholder = '0x' + '—'.repeat(40);
