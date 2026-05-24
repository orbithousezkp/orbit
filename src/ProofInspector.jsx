import { useEffect, useMemo, useState } from 'react';
import { keccak256, toBytes, recoverTypedDataAddress, getAddress, isAddress } from 'viem';
import './dashboard.css';

const REPO_URL = 'https://github.com/orbit-house/orbit';

const SCHEME = 'eip712:orbit-cycle-proof/1';
const DOMAIN = {
  name: 'Orbit Cycle Proof',
  version: '1',
  chainId: 8453
};
const TYPES = {
  CycleProof: [
    { name: 'brand', type: 'string' },
    { name: 'cycle', type: 'uint256' },
    { name: 'startedAt', type: 'string' },
    { name: 'finishedAt', type: 'string' },
    { name: 'trigger', type: 'string' },
    { name: 'dryRun', type: 'bool' },
    { name: 'totalSteps', type: 'uint256' },
    { name: 'payloadHash', type: 'bytes32' }
  ]
};
const PRIMARY_TYPE = 'CycleProof';
const ENVELOPE_KEYS = ['signature', 'signer', 'signedAt', 'signatureScheme', 'payloadHash'];
const MAX_CANONICAL_BYTES = 2 * 1024 * 1024;

function canonicalize(value) {
  if (value === undefined) throw new Error('canonicalize: undefined is not representable');
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalize: non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

function stripEnvelope(proof) {
  const body = { ...proof };
  for (const key of ENVELOPE_KEYS) delete body[key];
  return body;
}

function payloadHashOf(proof) {
  const text = canonicalize(stripEnvelope(proof));
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_CANONICAL_BYTES) {
    throw new Error(`canonical body ${bytes} bytes exceeds ${MAX_CANONICAL_BYTES}`);
  }
  return keccak256(toBytes(text));
}

function normalizeTrigger(trigger) {
  if (!trigger || typeof trigger !== 'object') return ':';
  return `${String(trigger.type || '')}:${String(trigger.id || '')}`;
}

function bigIntFrom(value) {
  if (typeof value === 'bigint') return value;
  if (value === undefined || value === null || value === '') return 0n;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`expected non-negative integer, got ${value}`);
  }
  return BigInt(n);
}

async function verifyProof(proof) {
  const base = {
    signed: false,
    verified: false,
    signer: null,
    recovered: null,
    scheme: null,
    payloadHash: null,
    reason: null
  };

  if (!proof || typeof proof !== 'object'
    || typeof proof.signature !== 'string'
    || typeof proof.payloadHash !== 'string'
    || typeof proof.signatureScheme !== 'string') {
    return { ...base, reason: 'not_signed' };
  }

  const declaredSigner = typeof proof.signer === 'string' && isAddress(proof.signer)
    ? getAddress(proof.signer)
    : null;
  const result = {
    ...base,
    signed: true,
    signer: declaredSigner,
    scheme: proof.signatureScheme,
    payloadHash: proof.payloadHash
  };

  if (proof.signatureScheme !== SCHEME) {
    return { ...result, reason: 'unknown_scheme' };
  }

  let computed;
  try {
    computed = payloadHashOf(proof);
  } catch (err) {
    return { ...result, reason: `canonicalize_failed:${err.message}` };
  }
  if (computed !== proof.payloadHash) {
    return { ...result, reason: 'payload_hash_mismatch' };
  }

  let recovered;
  try {
    recovered = await recoverTypedDataAddress({
      domain: DOMAIN,
      types: TYPES,
      primaryType: PRIMARY_TYPE,
      message: {
        brand: String(proof.brand || ''),
        cycle: bigIntFrom(proof.cycle),
        startedAt: String(proof.startedAt || ''),
        finishedAt: String(proof.finishedAt || ''),
        trigger: normalizeTrigger(proof.trigger),
        dryRun: Boolean(proof.dryRun),
        totalSteps: bigIntFrom(proof.totalSteps),
        payloadHash: computed
      },
      signature: proof.signature
    });
  } catch (err) {
    return { ...result, reason: `signature_invalid:${err.message}` };
  }

  const recoveredChecksum = getAddress(recovered);
  if (declaredSigner && declaredSigner !== recoveredChecksum) {
    return { ...result, recovered: recoveredChecksum, reason: 'recovered_address_mismatch' };
  }
  return { ...result, recovered: recoveredChecksum, verified: true };
}

function isSafeProofUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    const allowed = ['raw.githubusercontent.com', 'gist.githubusercontent.com', 'api.github.com'];
    if (!allowed.includes(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchProof(input) {
  if (!isSafeProofUrl(input)) {
    throw new Error('only https:// raw.githubusercontent.com, gist.githubusercontent.com, or api.github.com URLs are accepted');
  }
  const res = await fetch(input, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch returned http ${res.status}`);
  const text = await res.text();
  return parseProof(text);
}

function parseProof(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('input is empty');
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`not valid JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('proof must be a JSON object');
  }
  return parsed;
}

export default function ProofInspector() {
  const initialUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const hash = window.location.hash || '';
    const match = hash.match(/^#(?:inspect|proof)\?url=(.+)$/);
    if (!match) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return '';
    }
  }, []);

  const [pasted, setPasted] = useState('');
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [proof, setProof] = useState(null);
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialUrl) return;
    handleLoadUrl(initialUrl);
  }, [initialUrl]);

  async function handleLoadUrl(target) {
    setError(null);
    setProof(null);
    setVerification(null);
    setLoading(true);
    try {
      const parsed = await fetchProof(target);
      setProof(parsed);
      const result = await verifyProof(parsed);
      setVerification(result);
    } catch (err) {
      setError(String(err && err.message || err));
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyPasted() {
    setError(null);
    setProof(null);
    setVerification(null);
    try {
      const parsed = parseProof(pasted);
      setProof(parsed);
      setLoading(true);
      verifyProof(parsed)
        .then((result) => setVerification(result))
        .catch((err) => setError(String(err && err.message || err)))
        .finally(() => setLoading(false));
    } catch (err) {
      setError(String(err && err.message || err));
    }
  }

  return (
    <main className="dash inspect">
      <header className="dash-header">
        <div className="dash-header-row">
          <span className="dash-wordmark">orbit · proof inspector</span>
          <a className="dash-link" href="/">dashboard</a>
          <a className="dash-link" href={REPO_URL}>github</a>
        </div>
      </header>

      <section className="dash-section">
        <h2 className="dash-h2">verify an orbit cycle proof in your browser</h2>
        <p className="dash-muted">
          paste a proof JSON or load one by URL. verification runs entirely in this page
          using viem — nothing is uploaded.
        </p>
        <details className="inspect-explainer">
          <summary>what is a cycle proof?</summary>
          <p className="dash-muted">
            every time orbit runs a cycle (planning, acting, committing), it writes a JSON
            receipt to <code>runtime/proofs/&lt;date&gt;/&lt;timestamp&gt;.json</code> in the
            repo and signs it with an EIP-712 signature over the canonical payload hash.
          </p>
          <p className="dash-muted">
            this tool re-derives the payload hash and recovers the signer address from the
            signature. if the recovered signer matches the declared signer, the proof is
            authentic — nobody tampered with the steps, the trigger, or the result.
          </p>
        </details>
      </section>

      <section className="dash-section">
        <h3 className="dash-h3">load by URL</h3>
        <form
          className="inspect-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleLoadUrl(urlInput.trim());
          }}
        >
          <input
            type="url"
            className="inspect-input"
            placeholder="https://raw.githubusercontent.com/.../runtime/proofs/2026-05-23/<file>.json"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
          />
          <button type="submit" className="inspect-button" disabled={loading || !urlInput.trim()}>
            {loading ? 'loading...' : 'load + verify'}
          </button>
        </form>
        <p className="dash-muted inspect-hint">
          accepted hosts: raw.githubusercontent.com, gist.githubusercontent.com, api.github.com
        </p>
      </section>

      <section className="dash-section">
        <h3 className="dash-h3">or paste proof JSON</h3>
        <textarea
          className="inspect-textarea"
          rows={10}
          placeholder='{"brand":"orbit","cycle":27, ...}'
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
        />
        <div>
          <button
            type="button"
            className="inspect-button"
            onClick={handleVerifyPasted}
            disabled={loading || !pasted.trim()}
          >
            {loading ? 'verifying...' : 'verify pasted proof'}
          </button>
        </div>
      </section>

      {error && (
        <section className="dash-section inspect-error">
          <h3 className="dash-h3">error</h3>
          <pre className="dash-cmd">{error}</pre>
        </section>
      )}

      {verification && <VerificationResult result={verification} />}
      {proof && <DecodedProof proof={proof} />}
    </main>
  );
}

function VerificationResult({ result }) {
  let badge;
  let badgeClass;
  if (result.verified) {
    badge = 'signature verified';
    badgeClass = 'inspect-badge inspect-badge-ok';
  } else if (result.signed) {
    badge = `unverified · ${result.reason || 'unknown'}`;
    badgeClass = 'inspect-badge inspect-badge-bad';
  } else {
    badge = 'unsigned proof';
    badgeClass = 'inspect-badge inspect-badge-warn';
  }

  return (
    <section className="dash-section">
      <h3 className="dash-h3">verification</h3>
      <p><span className={badgeClass}>{badge}</span></p>
      <dl className="dash-dl">
        <div className="dash-dl-row">
          <dt>scheme</dt>
          <dd><code>{result.scheme || '-'}</code></dd>
        </div>
        <div className="dash-dl-row">
          <dt>declared signer</dt>
          <dd><code>{result.signer || '-'}</code></dd>
        </div>
        <div className="dash-dl-row">
          <dt>recovered signer</dt>
          <dd><code>{result.recovered || '-'}</code></dd>
        </div>
        <div className="dash-dl-row">
          <dt>payload hash</dt>
          <dd><code className="inspect-hash">{result.payloadHash || '-'}</code></dd>
        </div>
      </dl>
    </section>
  );
}

function DecodedProof({ proof }) {
  const fields = [
    ['brand', proof.brand],
    ['cycle', proof.cycle],
    ['startedAt', proof.startedAt],
    ['finishedAt', proof.finishedAt],
    ['trigger', proof.trigger ? `${proof.trigger.type || ''}:${proof.trigger.id || ''}` : '-'],
    ['dryRun', String(Boolean(proof.dryRun))],
    ['totalSteps', proof.totalSteps],
    ['result', proof.result || '-']
  ];
  const steps = Array.isArray(proof.steps) ? proof.steps : [];

  return (
    <section className="dash-section">
      <h3 className="dash-h3">decoded fields</h3>
      <dl className="dash-dl">
        {fields.map(([k, v]) => (
          <div className="dash-dl-row" key={k}>
            <dt>{k}</dt>
            <dd>{typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="dash-h3">steps ({steps.length})</h3>
      {steps.length === 0
        ? <p className="dash-muted">no steps recorded.</p>
        : (
          <ol className="inspect-steps">
            {steps.slice(0, 50).map((step, i) => (
              <li key={i}>
                <code>{step.tool || step.action || step.type || 'step'}</code>
                {step.ok === false && <span className="inspect-badge inspect-badge-bad inspect-badge-inline">failed</span>}
              </li>
            ))}
            {steps.length > 50 && <li className="dash-muted">... {steps.length - 50} more</li>}
          </ol>
        )}
    </section>
  );
}
