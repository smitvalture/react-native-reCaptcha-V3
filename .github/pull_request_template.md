<!--
Thanks for sending a pull request!

Title format: follow Conventional Commits — fix:, feat:, docs:, refactor:, test:, chore:, ci:
This drives the auto-generated changelog and semver bump.

For breaking changes: use feat!: in the title AND add a `BREAKING CHANGE:` section in the body.
-->

## Summary

<!-- 1-3 sentences on what this PR does and why. -->

## Type of change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Breaking change (`feat!:` + BREAKING CHANGE note)
- [ ] Documentation (`docs:`)
- [ ] Refactor with no behavior change (`refactor:`)
- [ ] Tests only (`test:`)
- [ ] Tooling / CI (`chore:` / `ci:`)

## Checklist

- [ ] `yarn lint` passes
- [ ] `yarn typecheck` passes
- [ ] `yarn test` passes (and I added or updated tests for behavioral changes)
- [ ] `yarn prepare` succeeds (the package builds)
- [ ] README updated if I changed the public API
- [ ] CHANGELOG entry is **not** needed — `release-it` + Conventional Commits handle this

## Test plan

<!-- How did you verify this works? What edge cases did you check? -->

## Related issues

<!-- Closes #N, Refs #N -->
