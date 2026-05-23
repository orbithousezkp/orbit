# Contributing to Issue Scam Scanner

Thanks for your interest in making open-source repos safer from hostile AI-agent content.

## What this project does

Issue Scam Scanner is a GitHub Action and CLI that detects prompt injection, wallet drain language, encoded relay, fake support, urgency traps, and other risky patterns in GitHub issues, PRs, and comments.

It was built by [Orbit](https://github.com/candyburst/orbit-private-live) as part of an open-source agent safety toolkit.

## Development setup

```bash
# Clone the repo
git clone https://github.com/candyburst/orbit-private-live.git
cd orbit-private-live

# Install dependencies (if any)
npm install

# Run tests
npm test --workspace=packages/issue-scam-scanner
# or
node --test tests/issue-scam-scanner.test.js
```

## Project structure

```
packages/issue-scam-scanner/
├── rules.js        # Risk pattern definitions (11 threat categories)
├── scan.js         # Core scanning engine
├── index.js        # Public API exports
├── action.yml      # GitHub Action definition
├── action.js       # GitHub Action runtime entrypoint
├── cli.js          # CLI wrapper
├── package.json
├── README.md
└── examples/
    ├── basic-issue-scan.yml   # Copy-paste workflow example
    └── custom-rules.json      # Example custom rules file
```

## How to contribute

### Reporting false positives / false negatives

Open an issue with:
1. The text that was flagged (or should have been flagged)
2. Whether it was a false positive (safe text flagged) or false negative (threat missed)
3. Which category is involved (if known)

### Adding rules

Rules live in `rules.js`. Each rule has:
- `severity`: 0–100 (higher = more dangerous)
- `category`: snake_case identifier
- `pattern`: RegExp (case-insensitive)
- `message`: human-readable explanation

When adding rules:
1. Keep patterns specific enough to avoid false positives on normal developer text
2. Test against both malicious and benign examples
3. Document the threat category in the README table

### Adding custom rule validation

The scanner supports user-provided custom rules via `--rules` (CLI) or `customRules` option (API). Validation is in `scan.js::validateCustomRule()`.

### Testing

```bash
# Run all tests
node --test tests/issue-scam-scanner.test.js

# Run a specific test
node --test tests/issue-scam-scanner.test.js -- --grep "prompt injection"
```

Tests should cover:
- Each threat category has at least one positive match
- Each threat category has at least one benign negative match
- URL scanning (shorteners, financial domains, unicode)
- Event-level scanning (title + body + comments combined)
- Edge cases (empty input, null, undefined, very long strings)
- Custom rules (valid, invalid, compiled from string)

### Code style

- No external dependencies (the package is intentionally zero-dep)
- Use `"use strict"` at the top of every file
- Keep functions small and well-documented
- Use JSDoc comments for public functions

## Roadmap

- [ ] More threat categories (social engineering patterns, impersonation)
- [ ] Confidence scoring (not just severity)
- [ ] Allow-list support for known safe text patterns
- [ ] SARIF output for GitHub code scanning integration
- [ ] Batch scanning (multiple files or issues)
- [ ] Integration with GitHub's automatic moderation features

## License

MIT
