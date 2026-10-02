---
name: pdx-mods-upload-check
description: "PDX Mods Stellaris uploader: run its Playwright upload test to publish a new test-mod version, and repair it when the live form drifts from its selectors (fails or hangs)."
---

# PDX Mods upload check

`pdx-mods-stellaris-uploader` drives the real Paradox Mods web form. PDX redesigns that form
without notice and there is no changelog or API for it, so the test goes stale in silence and
a **stale selector** surfaces as a hang rather than an error.

Selectors already lost to a redesign: a removed tab, a swapped file input, a deleted spinner
class, a renamed button, a changed post-publish redirect. Expect more than one to break at a
time — re-derive the whole path, not just the selector the log named.

## Daily loop

Run from the repo root. A healthy pass costs ~20s.

```bash
export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"   # step 0
PW="mcr.microsoft.com/playwright:v$(node -p "require('@playwright/test/package.json').version")-jammy"
```

**Step 0 — daemon.** The repo targets Playwright 1.59.1, whose browsers need system
dependencies that are not always present, so the test runs inside the `mcr.microsoft.com/playwright`
image — the same one `Dockerfile` builds from. Point `DOCKER_HOST` at the daemon's socket: a
system install uses the default above, a rootless install puts it under `XDG_RUNTIME_DIR`:

```bash
_rootless="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
[ -S "$_rootless/docker.sock" ] && export DOCKER_HOST="unix://$_rootless/docker.sock"
docker info >/dev/null || { echo "start your Docker daemon, then rerun"; exit 1; }
```

Adjust that block if your daemon listens elsewhere; everything below it is portable.

**Step 1 — bump the version.** PDX rejects a version number that already exists, so every run
needs a fresh one. Derive it rather than writing one down — a literal version makes the second
run of any loop fail on a duplicate. `bump-version.mjs` takes the higher of the published
version and the local descriptor, then bumps the patch, so it cannot hand back a number that is
already taken. The bump has to reach the archive too, or PDX reads a different version than the
form was told:

```bash
NEXT=$(docker run --rm -i -v "$PWD:/app" -w /app "$PW" \
  node .agents/skills/pdx-mods-upload-check/scripts/bump-version.mjs)
sed -i -E "s/^version=\"[0-9.]+\"/version=\"$NEXT\"/" test-mod/descriptor.mod
(cd test-mod && zip -u mod.zip descriptor.mod >/dev/null && unzip -p mod.zip descriptor.mod)
```

Done when the echoed descriptor shows `$NEXT` — on both the file and the archive.

**Step 2 — authenticate.** Skip when `.auth/user.json` (host, gitignored) is fresh.

```bash
docker run --rm -v "$PWD:/app" -w /app "$PW" yarn auth --reporter=line
```

Pass only the bind mount: the mounted `.env` is read by `dotenv/config`, which strips quotes.
`--env-file` hands values to Docker verbatim instead, and the quotes get typed into the login
form, which rejects them with "Please type a valid email address".

**Step 3 — upload.** The reduced `UPLOAD_TIMEOUT` sets the test timeout to 150s; the
20-minute default is how a stale selector hides as "still running". `--reporter=line` keeps the
run off the HTML report, which a container user often cannot write to inside a host-mounted
checkout and which then fails with `EACCES` after the result is already known.

```bash
docker run --rm -e UPLOAD_TIMEOUT=120000 -v "$PWD:/app" -w /app "$PW" yarn start --reporter=line
```

Done when the log prints `Step 0..4`, then `Mod uploaded!` and `1 passed`.

**Step 4 — verify.** The mod page lags while a submission sits under review, so read the API:

```bash
docker run --rm -i -v "$PWD:/app" -w /app "$PW" node -e '
const { request } = require("playwright");
(async () => {
  const c = await request.newContext({ storageState: ".auth/user.json" });
  const v = await (await c.get("https://api.paradox-interactive.com/mods/versions?modId=72663")).json();
  const last = v.modVersions.at(-1);
  console.log(v.modVersions.length, "versions | latest:", last.userVersion, last.created);
})();'
```

Done when the latest version is the one just bumped. `https://mods.paradoxplaza.com/uploaded`
lists what is still *Pending publication*; the mod page shows a `pending publication` banner
and `MOD VER.` while a submission is in review.

## When a step breaks

1. **Read the failing step's name and call log** — it names the stale selector outright
   (`Step 2. Fill version tab` means the tab it clicked is gone).
2. **Re-derive from the page.** Probe the live form and diff it against the table below:
   ```bash
   docker run --rm -i -v "$PWD:/app" -w /app "$PW" \
     node .agents/skills/pdx-mods-upload-check/scripts/probe-form.mjs
   ```
   It dumps tab names, each panel's controls under the panel's heading, file inputs, and the
   preview panel's buttons. The heading is how you spot that, say, the version fields moved
   into "Mod Files". For anything visual, have it write `/app/test-results/x.png` — the repo is
   mounted at `/app`, so the PNG is readable from the host.

   `bump-version.mjs` (step 1) and `probe-form.mjs` both read `.auth/user.json` and both take
   `MOD_ID`, `AUTH_FILE` and `MOD_FOLDER` from the environment, so they work against any mod.
3. **Update `index.test.ts`**, then rerun from step 3.
4. **Choose the version number by how far the previous run got:**
   - failed before the publish click → nothing was submitted → **reuse the same number**
   - failed after publish, or a `pending publication` banner appeared → **bump before rerunning**
   - a submitted version later superseded by a newer submission silently vanishes from the
     list, leaving a gap in the numbering. That is normal.

Done when the probe agrees with the table and step 3 prints `1 passed`.

`probe-form.mjs` deliberately stops at the publish button and reports its label and disabled
state. Publishing there submits a real version and **burns** that number — probe everything
up to it, and click only when the intent is to actually upload.

## Current form structure

Verified 2026-10-02 against mod 72663. **This table is the thing that goes stale** — when the
probe disagrees with it, the probe is right.

| Thing | Selector | Notes |
| --- | --- | --- |
| Tabs | `name`, `metadata`, `images`, `files`, `preview` | Rendered uppercase by CSS; Playwright's accessible-name matching is case-insensitive. There is **no `version` tab** |
| Version fields | `input[name="userModVersion"]`, `input[name="version"]` | Both live in the **`files`** panel (heading "Mod Files"), not `metadata` |
| Changelog / release notes | `textarea[name="changelogEntry"]` | **Required** — publish stays disabled while it is empty |
| Zip dropzone | `input[type="file"][accept=".zip"]` | Hidden (`display:none`). Use `setInputFiles` |
| Publish | `button` named `/publish new version/i` | Was "publish mod". Disabled while the changelog is empty |
| After publish | redirects to `/mods/{id}/Any` | **Not** `/uploaded` — shows a "pending publication" banner |
| Authentication | `link` "Edit / New version" on the mod page | Wait for `[class*=editMod] [class*=__loader]` to stop being active |

### Upload completion has no DOM signal

The file preview and its spinner render the instant a file is selected, and the spinner is
**never cleared** — so "the preview is visible" proves nothing. The only ground truth is the
S3 `PUT` carrying the bytes:

```ts
const fileUpload = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /amazonaws\.com/.test(r.url()),
    { timeout: UPLOAD_TIMEOUT },
);
await page.locator('input[type="file"][accept=".zip"]').setInputFiles(MOD_ARCHIVE_PATH);
invariant((await fileUpload).ok(), 'upload failed');
```

Keep this shape. An earlier version waited on a CSS class the redesign deleted, and the
"fixed" version waited on the preview being visible — which would happily publish a 5GB mod
that is still uploading.

## Shipping a fix

The upload test is the only artifact that ships; a fix that restores it needs a release. See
[`RELEASING.md`](references/RELEASING.md) for the conventional-commit and
`commit-and-tag-version` procedure, including two flags that are easy to lose.
