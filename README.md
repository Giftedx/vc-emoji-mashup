# EmojiMashup

A [Vencord](https://vencord.dev) userplugin that adds a **Mashup** tab to Discord's
emoji picker, for browsing and sending [Emoji Kitchen](https://emojikitchen.dev)
combinations.

Pick an emoji, browse the ~475 mashups it actually has, click one to send.
147,000 combinations across 619 emoji, bundled — no API key, no server, no account.

<!-- TODO: screenshot of the Mashup tab, and one of a mashup sent in chat -->

## How it works

Pick a left emoji from the grid, and the second page fills with **every mashup that
emoji really has** — each cell showing the finished image rather than the ingredients.
There are no dead ends: you only ever see combinations Google actually drew.

Clicking one inserts its image URL into your message box. Discord embeds it
server-side, so recipients see the image.

- **Search and category filter** over all 619 supported emoji
- **Recent** row remembering your last 24 mashups
- **Emoji sets** — render the picker in Twitter, Google or your system emoji style
- Also available as a chat-bar button, which keeps working if the tab patch ever breaks

### Two mashup engines

The picker has a **Kitchen / Faces** switch, because there are two genuinely
different ways to mash emoji together.

**Kitchen** is Google's Emoji Kitchen: 147,000 combinations across 619 emoji,
*hand-drawn* by Google's designers. Objects, animals, food, faces. Sent as a URL
that Discord embeds.

**Faces** is the [Emoji Mashup Bot](https://knowyourmeme.com/memes/sites/emoji-mashup-bot)
lineage: mashups *composited at runtime* from cut-up Twemoji — a base shape, one
emoji's eyes, another's mouth. 135 × 128 combinations, and order matters, so
swapping the two gives a different face. Faces only, since a coffee cup has no
eyes to borrow. These are generated in your client, so they upload as an image
attachment rather than a link.

Google's are more polished; Twemoji's cover pairings Google never drew, and are
what the original bot did before Emoji Kitchen existed.

> There is no Microsoft Fluent equivalent here. Emojipedia hosts one, but nobody
> publishes the cut-up Fluent parts needed to build it, and cutting them by hand
> is an art task rather than a coding one.

## Installation

Follow the official guide for
[installing custom plugins](https://docs.vencord.dev/installing/custom-plugins/) —
custom plugins require building Vencord from source.

Once you have a source install, clone this into `src/userplugins`:

```bash
git clone https://github.com/Giftedx/dismoji src/userplugins/dismoji
pnpm build && pnpm inject
```

Then restart Discord and enable **EmojiMashup** in Vencord settings.

> **Clone it, don't symlink it.** esbuild resolves Vencord's `@api/*` and `@utils/*`
> aliases from the nearest `tsconfig.json` above each source file. A symlink or
> junction resolves outside Vencord's tree and breaks the build with
> `Could not resolve "@api/ChatButtons"`. The dev config here is named
> `tsconfig.dev.json` for the same reason — a `tsconfig.json` beside `index.tsx`
> would shadow Vencord's.

### Preview permissions

Mashup images are hosted on `www.gstatic.com`, which Vencord blocks by default. The
first time you open the picker it offers to allow that host, which opens Vencord's
own permission dialog; you'll need to tick the trust checkbox and restart Discord.

**Declining is fine.** Sending works either way, since Discord fetches the image
server-side. Without the permission, combinations show as their two source emoji
instead of a preview.

## Settings

| Setting | Default | Effect |
|---|---|---|
| Emoji set | Twitter | Artwork for the emoji you pick from — Twitter, Google, or system |
| Send mode | Insert URL | Insert the URL into the message box, or copy it to the clipboard |
| Auto-close | On | Close the picker after choosing a mashup |

## Development

```bash
pnpm install
pnpm test        # unit tests plus integration tests against the real index
pnpm typecheck
```

Linting uses Vencord's own config (it enforces the licence header and import
order), so run it from your Vencord checkout:

```bash
pnpm exec eslint "src/userplugins/dismoji/**/*.{ts,tsx,mts}"
```

`codec.ts`, `kitchen.ts`, `emojiSets.ts` and `loadKitchen.ts` import nothing from
React or Vencord, which is what makes them testable in isolation. `index.tsx` and
`MashupPicker.tsx` are typechecked by Vencord's build instead — `tsconfig.dev.json`
deliberately excludes them.

### Regenerating the index

`kitchenData.ts` is generated and committed. Rebuild it when Google ships new
mashups (historically a few times a year):

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm build-index
```

It downloads the ~94 MB upstream metadata, strips it to a 375 KB gzipped index,
asserts invariants (619 emoji, at least 140k pairs, dates fitting the 7-bit field),
and HEAD-checks 20 sampled URLs against live gstatic. Any failure aborts the build
rather than shipping something broken. Set `METADATA_PATH` to reuse a local copy.

The Twemoji parts inventory for Faces mode has its own generator, pinned to an
upstream commit so part URLs can't shift under a moving branch:

```bash
pnpm build-parts     # regenerate twemojiParts.ts
pnpm verify-parts    # confirm sampled layer URLs still resolve
```

### Why the index is packed

The upstream metadata is ~94 MB of JSON, almost all of it derivable. Every asset URL
follows `.../emojikitchen/{date}/{L}/{L}_{R}.png`, so the only facts worth storing
per pair are its date and one bit of orientation — the URL's left-hand emoji is the
lower-indexed one in just 62,501 of 147,000 pairs, so inferring it would break 57%
of lookups. That gets each pair down to 5 bytes, and the dataset to 375 KB gzipped.

One rule to know before touching URL building: **every codepoint component takes its
own `u` prefix**. `263a-fe0f` becomes `u263a-ufe0f`, not `u263a-fe0f`. The naive form
matches only 75.9% of pairs and 404s on the rest. Tests pin this.

### The picker tab patch

The tab is a webpack patch against Discord's minified expression picker, so it will
eventually break when Discord reships their bundle. When it does, Vencord logs
`Patch by EmojiMashup had no effect` and undoes the patch group — the picker is left
untouched and the chat-bar button keeps working.

To re-derive the target module, run this in the Discord console:

```js
Object.keys(Vencord.Webpack.search("activeView", "soundboard"))
```

That returned exactly one module, whose source the three replacements in `index.tsx`
are written against.

## Limitations

- Emoji Kitchen covers **619 emoji**, not the full Unicode set, and only the pairs
  Google actually drew. There is no algorithm generating these.
- **Custom server emoji can't be mashed up** — Google has no artwork for them.
- **Kitchen mashups can't be restyled.** The emoji-set setting changes the emoji you
  pick from, not the combinations — those are always Google's artwork. Faces mode is
  the Twemoji-styled alternative, but it generates rather than restyles, and covers
  only faces.
- **No Microsoft Fluent mashups.** No public library of cut-up Fluent parts exists.
- Mashups send as a URL, not as a real emoji. Discord has no mechanism for sending
  arbitrary images inline as emoji.
- The Google emoji set covers 617/619 — ©️ and ®️ have no Noto asset and fall back
  to your system font.

## Credits

Kitchen mashup artwork © Google, from [Emoji Kitchen](https://emojikitchen.dev).
Pair metadata from [xsalazar/emoji-kitchen](https://github.com/xsalazar/emoji-kitchen).
Images are hot-linked from Google's CDN and never redistributed; the bundled index
holds only factual pair data — which combinations exist and when they shipped.

Faces mode uses cut-up Twemoji parts from
[Ryhon0/open-emoji-mash](https://github.com/Ryhon0/open-emoji-mash) (GPL-3.0),
fetched from jsDelivr at a pinned commit. Twemoji artwork © Twitter, CC-BY 4.0.
The technique comes from Louan Bengmah's
[Emoji Mashup Bot](https://knowyourmeme.com/memes/sites/emoji-mashup-bot).

## Licence

[GPL-3.0-or-later](./LICENSE), matching Vencord.
