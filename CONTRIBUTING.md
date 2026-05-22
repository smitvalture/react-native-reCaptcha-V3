# Contributing

Contributions are welcome — bug fixes, feature ideas, doc improvements, and tests are all appreciated. This is a single-package library; the setup is straightforward.

Before contributing, please read the [Code of Conduct](./CODE_OF_CONDUCT.md). If you're reporting a **security vulnerability**, please follow [SECURITY.md](./SECURITY.md) rather than opening a public issue.

## Development setup

```bash
git clone https://github.com/smitvalture/react-native-recaptcha-v3.git
cd react-native-recaptcha-v3
yarn install
```

This project uses Yarn 3 (Berry). The `.yarnrc.yml` pins the version; if you have Corepack enabled (`corepack enable`), the right Yarn will be picked up automatically.

## Scripts

| Script | What it does |
|--------|-------------|
| `yarn lint` | Run ESLint over `src/` |
| `yarn typecheck` | Run `tsc` in `--noEmit` mode |
| `yarn test` | Run the Jest test suite |
| `yarn test:ci` | Jest with coverage and `--ci` (matches what CI runs) |
| `yarn prepare` | Build the library to `lib/` via `react-native-builder-bob` |
| `yarn pack:local` | Clean build + `npm pack` to produce a local `.tgz` for testing in another project |
| `yarn release` | Bump version, tag, push, and publish via `release-it` (maintainers only) |

## Project layout

```
src/
  index.tsx              — the component
  __tests__/
    helpers.ts           — shared test utilities (mock WebView accessors)
    smoke.test.tsx       — basic render smoke tests
    regressions.test.tsx — guards for known historical bugs
    lifecycle.test.tsx   — public API behavior tests

jest.config.js           — Jest configuration
jest.setup.js            — Controllable WebView mock (jest.mock)
babel.config.js          — Env-aware: bob preset for builds, RN preset for tests
tsconfig.json            — Strict TypeScript config; excludes __tests__ from emit
tsconfig.build.json      — Used by bob for declaration emit

.github/workflows/ci.yml — Lint · typecheck · test · build, Node 20 + 22
```

## Testing the component

The WebView is mocked in [`jest.setup.js`](./jest.setup.js). Tests drive the component through the same lifecycle a real WebView would — `onLoadStart` → `onLoadEnd` → simulated `onMessage('READY')` → `getToken()` → simulated `onMessage('VERIFY')` — using helpers from [`src/__tests__/helpers.ts`](./src/__tests__/helpers.ts).

When fixing a bug, prefer adding a test that reproduces it under `src/__tests__/regressions.test.tsx`. When adding a feature, add behavioral tests under `lifecycle.test.tsx`.

## Code style

- ESLint + Prettier — run `yarn lint` and fix any reported issues.
- TypeScript — `strict` mode is on; no `any` in new code.
- React hooks — exhaustive-deps not currently enforced; mention it in PR review if relevant.

## Commit messages

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — this is what drives the automated changelog and semver bumps via `release-it`:

| Prefix | When to use | Version bump |
|--------|-------------|--------------|
| `fix:` | bug fixes | patch |
| `feat:` | new features | minor |
| `feat!:` or `BREAKING CHANGE:` in body | breaking changes | major |
| `refactor:` | code refactor with no behavior change | none |
| `docs:` | documentation only | none |
| `test:` | tests only | none |
| `chore:` | tooling, deps, ci | none |
| `ci:` | CI workflow changes | none |

## Pull requests

1. Branch from `main`. Use a descriptive name (`fix/onloadend-double-fire`, `feat/abort-signal`, etc).
2. Run `yarn lint && yarn typecheck && yarn test && yarn prepare` locally before pushing.
3. Open a PR against `main`. CI runs lint + typecheck + tests + build on Node 20 and 22.
4. Keep PRs focused — one logical change per PR is much easier to review than a bundle.
5. If your change affects the public API, update the README and add tests.

For larger architectural changes, open an Issue first to discuss the approach before writing code.

## Publishing (maintainers only)

```bash
yarn release
```

`release-it` will:
1. Read recent commits, infer the version bump from Conventional Commit prefixes
2. Generate a `CHANGELOG.md` entry
3. Create a git tag, push to `origin`, publish to npm, and create a GitHub release

Make sure your local `main` is up to date with `origin/main` and CI is green before releasing.
