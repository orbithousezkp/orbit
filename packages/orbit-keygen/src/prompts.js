/**
 * Hidden-input passphrase prompts.
 *
 * Uses raw-mode stdin so the user's passphrase is never echoed to the
 * terminal. Falls back to non-hidden read if stdin is not a TTY (e.g. when
 * the CLI is being scripted in tests with a piped passphrase) — in that
 * case the caller is responsible for not exposing the terminal.
 */

'use strict';

/**
 * Read a single line from stdin without echoing characters.
 *
 * Backspace deletes a character. Ctrl+C aborts the process. Enter
 * terminates input. Returns a string (no trailing newline).
 *
 * @param {string} promptText - text printed before reading
 * @param {object} [opts]
 * @param {NodeJS.ReadableStream} [opts.input=process.stdin]
 * @param {NodeJS.WritableStream} [opts.output=process.stdout]
 * @returns {Promise<string>}
 */
function readHiddenLine(promptText, opts = {}) {
  const input = opts.input || process.stdin;
  const output = opts.output || process.stdout;

  return new Promise((resolve, reject) => {
    if (promptText) output.write(promptText);

    const isTTY = input.isTTY === true;

    if (!isTTY) {
      // Non-interactive fallback. Read from an attached line buffer if
      // present (so multiple consecutive calls drain a single piped stdin
      // one line at a time). Otherwise, fall back to consuming `data`
      // events until the next newline.
      const next = consumeLine(input);
      if (next.ready) {
        return resolve(next.line);
      }
      let buf = next.remainder || '';
      const onData = (chunk) => {
        buf += chunk.toString('utf8');
        const nl = buf.indexOf('\n');
        if (nl !== -1) {
          input.removeListener('data', onData);
          input.removeListener('end', onEnd);
          const line = buf.slice(0, nl).replace(/\r$/, '');
          const rest = buf.slice(nl + 1);
          stashRemainder(input, rest);
          resolve(line);
        }
      };
      const onEnd = () => {
        input.removeListener('data', onData);
        input.removeListener('end', onEnd);
        resolve(buf.replace(/\r?\n?$/, ''));
      };
      input.on('data', onData);
      input.on('end', onEnd);
      input.on('error', reject);
      return;
    }

    const wasRaw = input.isRaw;
    try {
      input.setRawMode(true);
    } catch (err) {
      return reject(err);
    }
    input.resume();
    input.setEncoding('utf8');

    let line = '';
    const onData = (ch) => {
      // Handle multi-byte chunks one code point at a time
      for (const c of ch) {
        if (c === '\n' || c === '\r') {
          input.removeListener('data', onData);
          try { input.setRawMode(wasRaw === true); } catch {}
          input.pause();
          output.write('\n');
          return resolve(line);
        }
        if (c === '') {
          // Ctrl+C
          input.removeListener('data', onData);
          try { input.setRawMode(wasRaw === true); } catch {}
          input.pause();
          output.write('\n');
          process.exit(130);
        }
        if (c === '' || c === '\b') {
          // backspace
          if (line.length > 0) line = line.slice(0, -1);
          continue;
        }
        // Ignore other control bytes
        if (c.charCodeAt(0) < 0x20) continue;
        line += c;
      }
    };

    input.on('data', onData);
  });
}

/**
 * Prompt for a passphrase twice (with confirmation). Returns the
 * passphrase if both entries match. Throws "passphrase_mismatch" otherwise.
 *
 * @param {object} [opts]
 * @param {string} [opts.label="Passphrase"]
 * @param {number} [opts.minLength=8]
 * @returns {Promise<string>}
 */
async function readPassphraseConfirmed(opts = {}) {
  const label = opts.label || 'Passphrase';
  const minLength = typeof opts.minLength === 'number' ? opts.minLength : 8;

  const pass1 = await readHiddenLine(`${label}: `, opts);
  if (pass1.length < minLength) {
    const err = new Error('passphrase_too_short');
    err.code = 'passphrase_too_short';
    err.minLength = minLength;
    throw err;
  }
  const pass2 = await readHiddenLine(`${label} (confirm): `, opts);
  if (pass1 !== pass2) {
    const err = new Error('passphrase_mismatch');
    err.code = 'passphrase_mismatch';
    throw err;
  }
  return pass1;
}

/**
 * Prompt for a passphrase once (for decrypt-style flows).
 *
 * @param {object} [opts]
 * @param {string} [opts.label="Passphrase"]
 * @returns {Promise<string>}
 */
function readPassphrase(opts = {}) {
  const label = opts.label || 'Passphrase';
  return readHiddenLine(`${label}: `, opts);
}

module.exports = {
  readHiddenLine,
  readPassphrase,
  readPassphraseConfirmed,
};

// ---------------------------------------------------------------------------
// Internal: non-TTY line buffering.
//
// When stdin is a pipe (e.g. tests, scripts, `echo pp | orbit-keygen ...`),
// the readable emits a single chunk containing the entire input. The first
// readHiddenLine() drains everything up to the first newline; subsequent
// calls have no more `data` events to wait on, so they would hang forever.
// We stash unconsumed bytes on the input stream itself and consume from
// that buffer on subsequent calls.
// ---------------------------------------------------------------------------

const REMAINDER_KEY = Symbol.for('orbit-keygen.stdin.remainder');

function consumeLine(input) {
  const buf = input[REMAINDER_KEY];
  if (typeof buf !== 'string' || buf.length === 0) {
    return { ready: false, remainder: '' };
  }
  const nl = buf.indexOf('\n');
  if (nl === -1) {
    // No newline yet; keep remainder so the caller can append more data.
    input[REMAINDER_KEY] = '';
    return { ready: false, remainder: buf };
  }
  const line = buf.slice(0, nl).replace(/\r$/, '');
  input[REMAINDER_KEY] = buf.slice(nl + 1);
  return { ready: true, line };
}

function stashRemainder(input, rest) {
  if (typeof rest === 'string' && rest.length > 0) {
    input[REMAINDER_KEY] = rest;
  } else {
    input[REMAINDER_KEY] = '';
  }
}
