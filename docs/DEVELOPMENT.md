# Development

The gates, how the generated index is rebuilt, and why the design is the way it is.
User-facing documentation is in the [README](../README.md).
[CONTRIBUTING.md](../CONTRIBUTING.md) has the ground rules,
[CHANGELOG.md](../CHANGELOG.md) the release history, and
[SECURITY.md](../SECURITY.md) how to report a vulnerability in private.

```bash
pnpm install
pnpm check       # typecheck + tests, the two gates CI runs first
pnpm test        # unit tests plus integration tests against the real index
pnpm typecheck
pnpm verify-assets
pnpm verify-host-layout -- C:\path\to\Vencord
pnpm verify-patches -- C:\path\to\Vencord
```

If pnpm stops with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, run
`CI=true pnpm install`. pnpm wants to rebuild `node_modules` but has no TTY to ask.

The lint and the Vencord-facing typecheck use Vencord's own configuration. Run them
from your Vencord checkout, after you clone this repository into
`src/userplugins/emojiMashup`:

```bash
pnpm build
pnpm testTsc
pnpm exec eslint "src/userplugins/emojiMashup/**/*.{ts,tsx,mts}"
```

`codec.ts`, `kitchen.ts`, `emojiSets.ts` and `loadKitchen.ts` import nothing from
React or Vencord, which makes them testable in isolation. `tsconfig.dev.json`
excludes `index.tsx` and `MashupPicker.tsx` on purpose. Vencord's `testTsc` gate
covers those two instead.

CI repeats the build, the typecheck and the lint against a fresh checkout of
current Vencord, so host API drift shows before a release. `verify-host-layout`
runs those three gates against a full copy of this repository, in a temporary
worktree of the Vencord checkout you name. That checkout needs its dependencies
installed.

## Regenerating the index

`kitchenIndex.b64` holds the packed index and `kitchenIndexMeta.ts` its provenance.
Both are generated and committed. Rebuild them when Google ships new mashups, a few
times a year:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm build-index
```

The generator downloads ~94 MB of upstream metadata from a pinned commit and
records its SHA-256. It strips the data to a 375 KB gzipped index and asserts the
invariants: 619 emoji, at least 140k pairs, and dates that fit the 7-bit field. It
then sends a HEAD request for 20 sampled URLs against live gstatic. Any failure
stops the build. Set `METADATA_PATH` to use a local copy. The generator still
computes and records the hash.

After you commit a regenerated index, repin `INDEX_PIN` in `loadKitchen.ts` to that
commit. `build-index` prints the reminder, and `pnpm test` fails if the index and
its recorded digest differ.

The Twemoji parts inventory has its own generator, pinned to an upstream commit so
part URLs cannot move under a branch:

```bash
pnpm build-parts     # regenerate twemojiParts.ts
pnpm verify-parts    # confirm sampled layer URLs still resolve
pnpm verify-assets   # check Kitchen, face layers, Twemoji and pinned Noto assets
```

`verify-assets` gives every request a ten-second timeout. It also checks the CORS
header, which the SVG face layers need to flatten into a canvas safely.

## Why the plugin fetches the index

The plugin downloads the index at first picker open from a commit-pinned jsDelivr
URL, and checks its SHA-256 before decoding.

Compiling the index in, which this plugin did before, costs every Vencord user the
download whether or not they enable the plugin. Vencord builds all plugins into one
bundle, and enabling one is a runtime switch. Measured against a real build, the
compiled-in index added **520 KB raw / 292 KB gzipped**, more than double Vencord's
renderer over the wire. The fetch costs **20 KB raw / 6 KB gzipped**, and only the
people who open the picker pay the rest. For scale, the largest file in Vencord's
own `src/plugins` is 40 KB.

Runtime fetching is the usual method here. `clearURLs`, `petpet`, `oneko`,
`reactErrorDecoder` and `shikiCodeblocks` all do it, and `jsdelivr.net` is already
in Vencord's default CSP allowlist, so no host permission is involved.

The cost is real: if the index fetch fails, there is no Kitchen grid. Faces still
populates, because its parts inventory is 7 KB and bundled, so the picker degrades
to Faces rather than to nothing. A total network loss disables both, because the
Faces layers also come from jsDelivr.

## Why the index is packed

The upstream metadata is ~94 MB of JSON, almost all of it derivable. Every asset
URL has the form `.../emojikitchen/{date}/{L}/{L}_{R}.png`, so the only facts worth
storing per pair are its date and one bit of orientation. The URL's left-hand emoji
is the lower-indexed one in just 62,501 of the 147,000 pairs, so inferring it would
break 57% of lookups. That gets each pair to 5 bytes, and the dataset to 375 KB
gzipped.

Know one rule before you touch the URL builder: **every codepoint component takes
its own `u` prefix**. `263a-fe0f` becomes `u263a-ufe0f`, not `u263a-fe0f`. The
simple form matches only 75.9% of pairs, and the rest give a 404. Tests pin this.

## The picker tab patch

The tab is a webpack patch against Discord's minified expression picker, so it will
break when Discord ships a new bundle. Vencord then logs
`Patch by EmojiMashup had no effect` and undoes the patch group, leaving Discord's
picker as it was.

The tab is the only surface, so that also makes the plugin inert until you derive
the patch again. That is the accepted trade for not adding a second button to the
chat bar. It is also why `verify-patches` runs weekly against Discord's live bundle
and not only on push: the warning must arrive before a user finds the fault.

To derive the target module again, run this in the Discord console:

```js
Object.keys(Vencord.Webpack.search("activeView", "soundboard"))
```

That returned exactly one module. The three replacements in `index.tsx` are written
against its source.

## Compatibility gate

The deterministic release gate is:

1. the tests and the typecheck in this repository
2. the build, the typecheck and the lint inside current Vencord
3. live asset verification
4. the patch applying to Discord's live bundle
5. a real Discord smoke test of the picker tab

Step 4 is `pnpm verify-patches`, which CI runs on every push and weekly:

```bash
pnpm verify-patches -- C:\path\to\Vencord
```

It builds Vencord's reporter bundle with this plugin in a throwaway worktree, opens
`discord.com/login` under headless Chromium, then asserts that EmojiMashup patched
the expression-picker module with all three replacements present in the patched
source. **Nothing signs in and nothing is sent.** The patch applies while Discord's
webpack modules load, which happens on the login page, so no account is involved.

Two details make it a real check. It asserts the patched source *positively*,
because a plugin that never compiled in also never reports a failure. And it builds
with `--dev`, because Vencord records a factory's patched source only when
`IS_DEV`. Without that flag the evidence does not exist to read.

The patch was last verified against Discord build **584177**, module **731231**.
That is evidence of the last verification, not a compatibility promise. Discord can
replace the minified module at any time, and this job then fails. The tab is the
only surface, so that failure is the warning that matters.

Step 5 stays manual. Whether a mashup arrives in a channel needs a client that is
signed in, and no gate here does that.

The last run was on 2026-07-27, in two parts.

The send paths were confirmed against a client built from `df7a063`. The installed
clone was fast-forwarded to that commit and its tree confirmed clean, and Vencord
was rebuilt from it. The rebuilt `dist/renderer.js` was checked to contain the
plugin before the run. The maintainer confirmed that the Mashup tab opens and both
grids populate. A Kitchen mashup embeds from its URL, and a Faces mashup uploads as
an attachment. A new send lands at the front of the Recent row, and 😚 appears among
the Faces mouths. Those last two cover the picker fixes in 0.1.1.

The picker text was then confirmed against a client rebuilt from `4aae601`. That
commit changed five strings and nothing else. The Faces hint, the two count headers
and the blocked-preview notice all render their current wording.

That is the maintainer's word, not a transcript of each click. Read it as "the
picker works from this commit", not as proof of any single branch.

The run did not cover, and this page does not claim: migrating recents from the
pre-rename storage key, Faces staying usable when the index fails to load, the
ten-second layer timeout firing, and the index retrying after a failed fetch. The
last two need a throttled or cut connection, and tests pin them instead.

Check the installed commit before you record a run. An earlier smoke was retracted
because the installed plugin was a detached file copy, hours behind the repository:
it tested a bundled index and a surface already removed. A manual smoke proves
whatever the client was built from, not what the repository holds. Confirm the
commit, rebuild, and keep nothing but the plugin under `src/userplugins`. Vencord
compiles every directory there, so a `.bak` beside it silently ships a second copy.
