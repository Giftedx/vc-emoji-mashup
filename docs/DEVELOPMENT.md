# Development

Everything a contributor or reviewer needs: the gates, how the generated index is
rebuilt, and why the design is the way it is. User-facing documentation lives in
the [README](../README.md).

Contributions are welcome — [CONTRIBUTING.md](../CONTRIBUTING.md) has the ground
rules, [CHANGELOG.md](../CHANGELOG.md) the release history, and
[SECURITY.md](../SECURITY.md) how to report a vulnerability privately.

```bash
pnpm install
pnpm check       # typecheck + tests, the two gates CI runs first
pnpm test        # unit tests plus integration tests against the real index
pnpm typecheck
pnpm verify-assets
pnpm verify-host-layout -- C:\path\to\Vencord
pnpm verify-patches -- C:\path\to\Vencord
```

If pnpm aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` (it wants to
rebuild `node_modules` but has no TTY to ask), run `CI=true pnpm install`.

Linting and the Vencord-facing typecheck use Vencord's own configuration, so run
them from your Vencord checkout after cloning this repository into
`src/userplugins/emojiMashup`:

```bash
pnpm build
pnpm testTsc
pnpm exec eslint "src/userplugins/emojiMashup/**/*.{ts,tsx,mts}"
```

`codec.ts`, `kitchen.ts`, `emojiSets.ts` and `loadKitchen.ts` import nothing from
React or Vencord, which is what makes them testable in isolation. `index.tsx` and
`MashupPicker.tsx` are typechecked by Vencord's `testTsc` gate instead —
`tsconfig.dev.json` deliberately excludes them. CI repeats the build, typecheck
and lint against a fresh checkout of current Vencord so host API drift is visible
before release. `verify-host-layout` runs the same three gates against a complete
copy of this repository in a temporary worktree of the supplied Vencord checkout;
the checkout must already have its dependencies installed.

## Regenerating the index

`kitchenIndex.b64` holds the packed index and `kitchenIndexMeta.ts` its
provenance. Both are generated and committed. Rebuild them when Google ships new
mashups (historically a few times a year):

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm build-index
```

It downloads the ~94 MB upstream metadata from a pinned commit, records the
input's SHA-256 in the generated file, strips it to a 375 KB gzipped index,
asserts invariants (619 emoji, at least 140k pairs, dates fitting the 7-bit
field), and HEAD-checks 20 sampled URLs against live gstatic. Any failure aborts
the build rather than shipping something broken. Set `METADATA_PATH` to reuse a
local copy; its content hash is still recomputed and recorded.

After committing a regenerated index, repin `INDEX_PIN` in `loadKitchen.ts` to
that commit. `build-index` prints the reminder, and `pnpm test` fails if the
index and its recorded digest ever drift apart.

The Twemoji parts inventory for Faces mode has its own generator, pinned to an
upstream commit so part URLs can't shift under a moving branch:

```bash
pnpm build-parts     # regenerate twemojiParts.ts
pnpm verify-parts    # confirm sampled layer URLs still resolve
pnpm verify-assets   # check Kitchen, face layers, Twemoji and pinned Noto assets
```

`verify-assets` applies a ten-second timeout to every request and also verifies
the CORS header required to flatten the SVG face layers into a canvas safely.

## Why the index is fetched, not bundled

The index is downloaded on first picker open from a commit-pinned jsDelivr URL,
and its SHA-256 is checked before it is decoded.

The alternative — compiling it in, which is what this plugin used to do — costs
every Vencord user the download whether or not they enable the plugin, because
plugins are compiled into one bundle and enabling is a runtime switch. Measured
against a real build, bundling added **520 KB raw / 292 KB gzipped**, more than
doubling Vencord's renderer over the wire. Fetching costs **20 KB raw / 6 KB
gzipped**, and only people who open the picker pay for the rest. For scale, the
largest file anywhere in Vencord's own `src/plugins` is 40 KB.

Fetching runtime data is the ordinary way to do this — `clearURLs`, `petpet`,
`oneko`, `reactErrorDecoder` and `shikiCodeblocks` all do it, and `jsdelivr.net`
is already in Vencord's default CSP allowlist, so no host permission is involved.

The cost is honest: no network, no Kitchen grid. Faces mode is unaffected, since
its parts inventory is 7 KB and already fetched, so the picker degrades to Faces
rather than to nothing.

## Why the index is packed

The upstream metadata is ~94 MB of JSON, almost all of it derivable. Every asset URL
follows `.../emojikitchen/{date}/{L}/{L}_{R}.png`, so the only facts worth storing
per pair are its date and one bit of orientation — the URL's left-hand emoji is the
lower-indexed one in just 62,501 of 147,000 pairs, so inferring it would break 57%
of lookups. That gets each pair down to 5 bytes, and the dataset to 375 KB gzipped.

One rule to know before touching URL building: **every codepoint component takes its
own `u` prefix**. `263a-fe0f` becomes `u263a-ufe0f`, not `u263a-fe0f`. The naive form
matches only 75.9% of pairs and 404s on the rest. Tests pin this.

## The picker tab patch

The tab is a webpack patch against Discord's minified expression picker, so it will
eventually break when Discord reships their bundle. When it does, Vencord logs
`Patch by EmojiMashup had no effect` and undoes the patch group, leaving Discord's
picker untouched.

The tab is the only surface, so that also leaves the plugin inert until the patch
is re-derived. That is the deliberate trade for not crowding the chat bar with a
second button, and it is why `verify-patches` runs weekly against Discord's live
bundle rather than only on push: the warning should arrive before a user notices.

To re-derive the target module, run this in the Discord console:

```js
Object.keys(Vencord.Webpack.search("activeView", "soundboard"))
```

That returned exactly one module, whose source the three replacements in `index.tsx`
are written against.

## Compatibility gate

The deterministic release gate is:

1. this repository's tests and typecheck;
2. build, typecheck and lint inside current Vencord;
3. live asset verification;
4. the patch applying to Discord's live bundle; and
5. a real Discord smoke of the picker tab.

Step 4 is `pnpm verify-patches`, and it runs in CI on every push and weekly:

```bash
pnpm verify-patches -- C:\path\to\Vencord
```

It builds Vencord's reporter bundle with this plugin inside a throwaway
worktree, opens `discord.com/login` under headless Chromium, and asserts the
expression-picker module was patched by EmojiMashup with all three replacements
present in the patched source. **Nothing signs in and nothing is sent** — the
patch applies while Discord's webpack modules load, which happens on the login
page, so no account is involved.

Two details make it a real check rather than a reassuring one. It asserts the
patched source *positively*, because a plugin that never compiled in also never
reports a failure. And it builds with `--dev`, because Vencord only records a
factory's patched source when `IS_DEV` — without it the evidence does not exist
to read.

The patch was last verified against Discord build **582977**, module
**731231**. Treat that as evidence of the last verification, not a compatibility
promise: Discord can replace the minified module at any time, at which point this
job goes red — and since the tab is the only surface, that is the warning that
matters.

Step 5 stays manual: whether a mashup actually arrives in a channel needs a
logged-in client, and no gate here does that for you.

Last performed on 2026-07-26 against a client verified to be built from
`33b97cc` — the installed checkout's HEAD was compared to this repository's,
matched exactly, and Vencord was rebuilt from it before the run. The picker was
confirmed working by the maintainer after that rebuild, covering the paths this
release changed: the Faces grid, sending from both engines, and the Recent row.

The confirmation is the maintainer's, not a per-click transcript, so treat it as
"the picker works from this commit" rather than proof of any individual branch.

Not covered by that run, and so not claimed: the one-time migration of recents
from the pre-rename storage key, Faces remaining usable when the index fails to
load, the ten-second layer-load timeout actually firing, and the index retrying
after a failed fetch. Those last two need a throttled or severed connection to
reach, and are pinned by tests rather than by a send.

The check before recording one of these matters. An earlier smoke was retracted
because the installed plugin was a detached file copy that had drifted hours
behind the repository, so it tested a bundled index and a surface that had since
been removed. A manual smoke proves whatever the client was actually built from,
which is not necessarily what the repository says. Confirm the installed commit
against this repository's HEAD, rebuild, and keep nothing but the plugin under
`src/userplugins` — Vencord compiles every directory there, so a `.bak` beside it
silently ships a second copy of the plugin.

