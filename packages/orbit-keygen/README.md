# @orbit-house/keygen — Local Ethereum keystore generator

Generate Ethereum keypairs on your own machine, encrypt them with a
passphrase, and write them as Web3 Keystore v3 files. The same format
MetaMask, Frame, and `geth account import` consume.

**Private keys never leave the local filesystem.** They are not printed,
not transmitted, and not written to any disk location other than
`./keys/<slot>.json` (encrypted).

```
$ npx orbit-keygen new signer
Generating keypair for slot "signer"...
Passphrase: ************
Passphrase (confirm): ************
0xa3f1...c92e

Private key is encrypted in /you/your-repo/keys/signer.json.
Back up this file AND your passphrase separately.
Added "keys/" to .gitignore.
```

The only thing printed to stdout is the public Ethereum address. The
private key stays encrypted on disk.

---

## Security model

This tool gives you self-custody of Ethereum keys without depending on a
cloud KMS, a browser extension, or a password manager that you trust to
hold raw key material.

### What this protects against

- **Network adversaries.** Keys never touch the network. There is no
  call-home, no telemetry, no "send to the cloud for backup".
- **Casual disk inspection.** The on-disk file is encrypted with scrypt
  (N=131072, r=8, p=1 by default) + AES-128-CTR. A pure-passphrase brute
  force is bounded by your passphrase entropy; an attacker who steals
  only the `.json` file cannot recover the key without your passphrase.
- **Accidental git commits.** `keys/` is auto-added to `.gitignore` on
  first run.
- **Mixing up addresses.** `orbit-keygen verify <slot>` decrypts in
  memory and re-derives the address from the private key, then confirms
  it matches the keystore metadata. This catches corrupted files,
  mistaken slots, and any tampering with the address field.

### What this does NOT protect against

- **A compromised machine.** If your computer has a keylogger, screen
  recorder, malicious shell hook, or a compromised Node binary,
  everything below is moot.
- **A weak passphrase.** Scrypt makes brute force expensive but not
  impossible. Use a generated passphrase of at least 16 characters
  (diceware-style: 6 random words is fine).
- **Shoulder surfing.** Passphrase input is hidden (no echo), but
  obviously you should not run `orbit-keygen new` on a screen anyone
  else can see.
- **Loss of passphrase.** There is no recovery. If you lose the
  passphrase, the key is gone forever. Back up the passphrase
  separately from `./keys/`.
- **Loss of the keystore file.** Same. Back up `./keys/<slot>.json` to
  separate physical storage.
- **`--show-key`.** If you pass this flag, the private key is printed
  to stdout for one invocation. Anyone with shell history, terminal
  scrollback, a tmux session log, or a CI artifact can steal it. The
  tool prints a loud warning when you use it; the flag exists only for
  cold-storage workflows on a freshly booted air-gapped machine.

---

## Install

```
npm install --save-dev @orbit-house/keygen
# or, inside the orbit monorepo:
npm install
```

The package depends on `@noble/curves` and `@noble/hashes` (both
audited, minimal, zero-transitive-dependency packages). Everything else
is Node built-ins (`crypto`, `fs`, `readline`).

Requires Node >= 18.

---

## Usage

```
orbit-keygen new <slot>            Generate keypair, encrypt, write to ./keys/<slot>.json
orbit-keygen address <slot>        Print address from keystore metadata (no passphrase)
orbit-keygen list                  List all keystores in ./keys/
orbit-keygen verify <slot>         Decrypt with passphrase, confirm address matches
orbit-keygen --help                Show usage

Options:
  --out <dir>     Output directory (default: ./keys/)
  --force         Overwrite existing keystore on `new`
  --show-key      After `new`, print private key (DANGEROUS; default off)
  --kdf-n <N>     scrypt N parameter (default: 131072; 1024 for testing)
```

### Common workflows

Generate the three keys an Orbit token launch needs:

```
orbit-keygen new deployer
orbit-keygen new operator
orbit-keygen new signer
orbit-keygen list
```

Verify a backup file you restored from cold storage:

```
cp /backup/keys/signer.json ./keys/signer.json
orbit-keygen verify signer
```

Import into MetaMask:

```
# Settings -> Advanced -> Import Account -> JSON file
# Select ./keys/<slot>.json
# Enter the passphrase you used at generation time.
```

Import into Frame:

```
# Add Account -> Keystore
# Select ./keys/<slot>.json -> enter passphrase
```

Import into geth:

```
geth account import ./keys/<slot>.json
```

### Programmatic use

```js
const keygen = require('@orbit-house/keygen');

const { privateKey, address } = keygen.generateKeypair();
// privateKey is a 32-byte Buffer. address is "0x..." (40 hex chars, lowercase).

await keygen.writeKeystore({
  slot: 'signer',
  privateKey,
  passphrase: 'correct horse battery staple',
});

const ks = keygen.loadKeystore('signer');
const decrypted = await keygen.keystore.decrypt(ks, 'correct horse battery staple');
// decrypted is the original 32-byte private key Buffer.
keygen.wipe(decrypted); // best-effort zero of the in-memory buffer
```

---

## Backup recommendations

The keystore JSON file + your passphrase together control the key. Lose
either one and the key is gone. Store them separately:

- **Keystore file (`./keys/<slot>.json`):** at least 3 copies across
  different physical media. Encrypted USB drives, a printed QR code, or
  cloud storage are all acceptable since the file is itself encrypted.
- **Passphrase:** offline only. Paper, an engraved metal plate, or a
  hardware-backed password manager. Never store the passphrase in the
  same place as the keystore file.

A useful rule of thumb: if a single physical theft event can give an
attacker both the keystore and the passphrase, your backup is too
centralized. Keep them in different rooms / different cities / different
custodians.

---

## Storage layout

```
./keys/
  signer.json     Web3 Keystore v3, file mode 0600
  operator.json
  deployer.json
.gitignore        contains "keys/" line (auto-added)
```

Each `.json` file is a self-contained Web3 Keystore v3 object —
portable to any wallet that consumes the format. The keystore directory
is created on first use and the file permissions are set to `0600` on
Unix.

---

## Why local?

**vs. cloud KMS (AWS KMS, GCP KMS, etc.):** Cloud KMS is fine for
operational signing of high-volume API traffic, but it makes a third
party part of your trust boundary. For the kind of long-lived
treasury / deployment keys this package is built for, the simpler thing
is: generate them on your machine, encrypt them with scrypt, and back up
the encrypted file like any other backup.

**vs. password manager:** Most password managers don't store
arbitrary key material gracefully, and pasting a hex string through the
clipboard exposes it to shell history, browser extensions, and any
process that watches the clipboard. A signed keystore file you decrypt
on demand keeps the raw key in memory for the shortest possible time.

**vs. hardware wallet:** Hardware wallets are strictly stronger for
day-to-day use and Orbit recommends them for the operator key.
`orbit-keygen` is for cases where a hardware device is impractical
(e.g. CI signing, automated deploys, or initial bootstrap before you
have your hardware wallet on hand).

---

## Format reference

The output file conforms to the Ethereum Web3 Secret Storage v3 spec:

```json
{
  "address": "abc...def",
  "crypto": {
    "cipher": "aes-128-ctr",
    "cipherparams": { "iv": "<16-byte hex>" },
    "ciphertext": "<encrypted private key, hex>",
    "kdf": "scrypt",
    "kdfparams": {
      "dklen": 32,
      "n": 131072,
      "p": 1,
      "r": 8,
      "salt": "<32-byte hex>"
    },
    "mac": "<keccak256(derivedKey[16:32] || ciphertext), hex>"
  },
  "id": "<uuid v4>",
  "version": 3
}
```

Encryption is:

```
derivedKey = scrypt(passphrase, salt, dklen=32, N, r, p)
ciphertext = AES-128-CTR(derivedKey[0:16], iv, privateKey)
mac        = keccak256(derivedKey[16:32] || ciphertext)
```

The MAC uses Ethereum's keccak-256, not NIST SHA3-256. Mixing these up
is the single most common implementation bug — `orbit-keygen` uses
`@noble/hashes` keccak_256 which is the correct variant.

---

## License

MIT. See LICENSE.
