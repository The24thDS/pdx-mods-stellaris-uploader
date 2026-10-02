# Releasing an upload-flow fix

Reached from [`SKILL.md`](../SKILL.md) once the daily loop passes again.

```bash
git add -A && git commit            # fix: <what the form did, what you re-derived>
yarn release                         # no flags: see .versionrc and package.json
git push --follow-tags origin main
```

`yarn release` needs no arguments. Two files own the configuration, and repeating either here
would only create a second place to keep in step:

- **`.versionrc`** holds `"prerelease": "alpha"`. This is what keeps the tool on the alpha
  track — without it a release cuts a stable `2.0.0` off `2.0.0-alpha.N`. Delete the key when
  the track graduates to stable.
- **`package.json`** holds the tool (`commit-and-tag-version`) and its changelog preset
  (`conventional-changelog-conventionalcommits`) as devDependencies, plus the `release` script.
  The preset must live in *this project*: `conventional-changelog` resolves presets from the
  project root, so a preset reached only through `npx`'s temporary store fails with
  `Unable to load the "conventional-changelog-conventionalcommits" preset`.

The `v*.*.*` tag triggers `.github/workflows/docker-publish.yml`, which rebuilds and pushes the
GHCR image — so the tag is the release, and pushing it is what publishes.

## Staying on the v11 line

v13 resolves the last *non-prerelease* tag when diffing. On an alpha track that rebuilds
`CHANGELOG.md` from the last stable tag — duplicating already-published entries and rewriting
every compare link to `v1.1.2...v2.0.0-alpha.N`. v11.3.0 diffs from the actual previous
prerelease tag instead.

Verify a toolchain change before trusting it with a real release:

```bash
yarn release --dry-run
```

Read the compare link it prints. If it does not begin at the previous tag, that toolchain will
rewrite history in the changelog.

Keep the skill's selector table in step with `index.test.ts` in the same commit: the table is
the claim that the form matches, and a fix that changes the selectors without changing the
table leaves the next reader debugging a stale document.

A release whose commits are all `docs:` renders an empty changelog section — the
conventionalcommits preset has no `docs` category, so a docs-only release has nothing to list.
