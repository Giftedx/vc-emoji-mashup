# dismoji — Emoji Kitchen mashups in Discord

A [Vencord](https://vencord.dev) userplugin that lets you browse Google's Emoji
Kitchen mashups and drop them straight into a message. Pick an emoji, browse the
~475 mashups it actually has, click one to send.

147,000 mashups across 619 emoji, bundled — no API, no server, no account.

## Before you start

**The standard Vencord install cannot run this.** The installer ships a prebuilt
bundle with no way to load custom plugins. Running any userplugin means building
Vencord from source and injecting that build over your current one.

This is a one-time setup, but it changes how you update Vencord afterwards: you
pull and rebuild instead of running the installer. You can always go back by
running the official Vencord installer again.

Requires Node >= 22 and pnpm.

## Install

```bash
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
pnpm install --frozen-lockfile

git clone <this-repo-url> src/userplugins/dismoji

pnpm build
pnpm inject
```

`pnpm inject` is interactive — it asks which Discord install to patch. Restart
Discord fully afterwards (quit from the tray, not just the window), then enable
**EmojiMashup** in Vencord settings.

### Do not symlink the plugin

Clone or copy it in — don't use a symlink or junction, and don't add a
`tsconfig.json` next to `index.tsx`. esbuild resolves Vencord's `@api/*`,
`@utils/*` and `@webpack/*` aliases from the nearest `tsconfig.json` walking up
from each source file. A link resolves outside Vencord's tree, and a local
`tsconfig.json` shadows Vencord's; both fail with
`Could not resolve "@api/ChatButtons"`. That is why the dev config here is named
`tsconfig.dev.json`.

## Using it

Click the mashup button in the chat bar. Pick a left emoji, then pick from its
partners — every cell is the real mashup image, so you browse results rather than
guessing at combinations. Clicking one drops its URL into your message box.

Your last 24 mashups are kept in a **Recent** row.

### Preview permissions

The mashup images are hosted on `www.gstatic.com`, which Vencord blocks by
default. The first time you open the picker it offers to allow it, which opens
Vencord's own host-permission dialog. You have to tick the trust checkbox and
restart Discord.

**Declining is fine.** Sending still works either way — Discord fetches the image
server-side, so everyone else sees it normally. You just won't see previews
while picking.

### Settings

| Setting | Default | Effect |
|---|---|---|
| Send mode | Insert URL | Insert the URL into the message box, or copy it to the clipboard |
| Auto-close | On | Close the picker after choosing a mashup |

## Development

```bash
pnpm install
pnpm test        # unit + real-index integration tests
pnpm typecheck
```

`codec.ts`, `kitchen.ts` and `loadKitchen.ts` have no React or Vencord imports,
which is what makes them testable in isolation. `index.tsx` and
`MashupPicker.tsx` are typechecked by Vencord's build instead.

### Regenerating the index

`kitchenData.ts` is generated and committed. Rebuild it when Google ships new
mashups (roughly quarterly):

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm build-index
```

This downloads the ~94 MB upstream metadata, strips it to a ~375 KB gzipped
index, asserts invariants (619 emoji, >=140k pairs, dates fitting the 7-bit
field), and HEAD-checks 20 sampled URLs against live gstatic. Any of those
failing aborts the build rather than shipping a broken index.

Set `METADATA_PATH` to reuse a local copy instead of re-downloading.

### Why the index is packed

The upstream metadata is ~94 MB of JSON, almost all of it derivable. Every asset
URL follows `.../emojikitchen/{date}/{L}/{L}_{R}.png`, so the only fact worth
storing per pair is its date — plus one bit of orientation, because the URL's
left-hand emoji is not the lower-indexed one (it is in only 62,501 of 147,000
pairs, so inferring it would break 57% of lookups).

That reduces each pair to 5 bytes, and the whole dataset to 783 KB packed /
375 KB gzipped.

One rule worth knowing if you touch URL building: **every codepoint component
takes its own `u` prefix** — `263a-fe0f` becomes `u263a-ufe0f`, not `u263a-fe0f`.
The naive form matches only 75.9% of pairs and 404s on the rest. There are tests
pinning this.

## Credits

Mashup artwork © Google, from
[Emoji Kitchen](https://emojikitchen.dev). Pair metadata from
[xsalazar/emoji-kitchen](https://github.com/xsalazar/emoji-kitchen).

Images are hot-linked from Google's CDN, never redistributed. The bundled index
contains only factual pair data (which combinations exist, and when they shipped).

## Limitations

- Emoji Kitchen covers 619 emoji, not the full Unicode set. Custom server emoji
  can't be mashed up — Google has no artwork for them.
- Only pairs Google actually drew exist. There is no algorithm generating these.
- Mashups send as a URL, not as a real emoji — Discord has no mechanism for
  sending arbitrary images inline as emoji.
