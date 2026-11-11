# Testing

> Moved verbatim from `CLAUDE.md` on 2026-11-11 (test rules, framework, test infrastructure, Mocha config). `CLAUDE.md` points here; keep this file accurate whenever the behaviour it describes changes.

## Testing

**Rule: Always add or update tests when adding or modifying any function.**

**Rule: When a test fails, fix the bug in the codebase — never modify the test to silence a failure. The only valid reason to change a test is if the test itself is provably wrong (e.g., it tests the wrong behaviour or has a logic error), and even then, document why in the commit message.**

**Framework:** Mocha + Sinon (no proxyquire needed for command tests)

**Run tests:**
```bash
npm test          # Mocha unit tests (no VS Code process needed)
npm run test:vscode  # Full VS Code integration tests
```

**Key test infrastructure:**

- `test/setup.js` — Mocha `require` file; installs a hook so `require('vscode')` returns the mock
- `test/vscode.mock.js` — minimal stub of the VS Code API
- `test/helpers/makeCtx.js` — exports `makeCtx(overrides?)`, `makeAtomWorkspace(overrides?)`, `makeAppWorkspace(overrides?)`, `FAKE_ROOT`, `ATOM_DIR`. Provides a plain stub `ExecutionContext` with sinon stubs for all `ctx.check.*` and `ctx.write.*` methods.
- `test/samples/atom/` — fixture ATOM directory with real gemspec, locales, lib/

**Command tests** (in `test/*.test.js`):
- Use `makeCtx()` directly — no proxyquire, no `fs` stubs for guard paths
- Override check stubs to test failure: `ctx.check.isDir.returns({ ok: false, message: 'err' })`
- Stub `vscode.window.showInputBox` for input flows (CommandRunner delegates to it)

**Library tests** (in `test/libs/*.test.js`):
- Use proxyquire only for OS-level tests (`os.test.js`)
- Stub `fs` / `vscode` directly for `check.test.js` and `executionContext.test.js`
- `check.test.js` calls may pass extra args (legacy `oc()`) — these are silently ignored

**Mocha config (`.mocharc.yml`):**
```yaml
require:
  - test/setup.js
spec: "test/**/*.test.js"
timeout: 10000
```
