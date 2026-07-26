# EmojiMashup

[![CI](https://github.com/Giftedx/vc-emoji-mashup/actions/workflows/ci.yml/badge.svg)](https://github.com/Giftedx/vc-emoji-mashup/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Giftedx/vc-emoji-mashup)](https://github.com/Giftedx/vc-emoji-mashup/releases/latest)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](./LICENSE)

A [Vencord](https://vencord.dev) userplugin that adds a **Mashup** tab to Discord's
emoji picker, with two ways to combine emoji:

- **[Emoji Kitchen](https://emojikitchen.dev)** — 147,000 combinations across 619
  emoji, hand-drawn by Google. No API key, server or account.
- **Faces** — mashups built at runtime from cut-up Twemoji, in the style of the
  original [Emoji Mashup Bot](https://knowyourmeme.com/memes/sites/emoji-mashup-bot).

Pick an emoji, browse the mashups it actually has, click one to send.

![EmojiMashup's Kitchen picker running in Discord](./docs/images/emoji-mashup-picker.png)

**[How it works](#how-it-works)** · **[Installation](#installation)** ·
**[Settings](#settings)** · **[Development](#development)** ·
**[Limitations](#limitations)** · **[Credits](#credits)**

## How it works

Pick a left emoji from the grid, and the second page fills with **every mashup that
emoji really has** — each cell showing the finished image rather than the ingredients.
There are no dead ends: you only ever see combinations Google actually drew.

Clicking one inserts its image URL into your message box. Discord embeds it
server-side, so recipients see the image.

- **Search and category filter** over all 619 supported emoji
- **Recent** row remembering your last 24 Emoji Kitchen mashups
- **Emoji sets** — render the picker in Twitter, Google or your system emoji style

### Two mashup engines

The picker has a **Kitchen / Faces** switch, because there are two genuinely
different ways to mash emoji together.

**Kitchen** is Google's Emoji Kitchen: 147,000 combinations across 619 emoji,
*hand-drawn* by Google's designers. Objects, animals, food, faces. Sent as a URL
that Discord embeds.

**Faces** is the [Emoji Mashup Bot](https://knowyourmeme.com/memes/sites/emoji-mashup-bot)
lineage: mashups *composited at runtime* from cut-up Twemoji — a base shape, one
emoji's eyes, another's mouth. 135 × 129 combinations, and order matters, so
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
git clone https://github.com/Giftedx/vc-emoji-mashup src/userplugins/emojiMashup
pnpm build && pnpm inject
```

Then restart Discord and enable **EmojiMashup** in Vencord settings.

> **Clone it, don't symlink it.** esbuild resolves Vencord's `@utils/*` and
> `@webpack/*` aliases from the nearest `tsconfig.json` above each source file. A
> symlink or junction resolves outside Vencord's tree and breaks the build with
> `Could not resolve "@utils/discord"`. The dev config here is named
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
| Send mode | Insert URL | For Kitchen: insert the URL into the message box, or copy it to the clipboard. Faces always open Discord's image-upload prompt |
| Auto-close | On | Close the picker after choosing a mashup |

## Development

Contributions are welcome — [CONTRIBUTING.md](./CONTRIBUTING.md) has the ground
rules and [CHANGELOG.md](./CHANGELOG.md) the release history.

```bash
pnpm install
pnpm check       # typecheck + tests, the two gates CI runs first
```

**[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** covers the rest: the full gate
list, regenerating the packed Emoji Kitchen index, the webpack patch behind the
picker tab, and why the index is fetched rather than bundled.

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
- **Kitchen mode needs network on first open**, since the index is fetched rather
  than bundled. It is cached for the session, and Faces mode stays usable without
  it.

## Credits

Kitchen mashup artwork © Google, from [Emoji Kitchen](https://emojikitchen.dev).
Pair metadata from [xsalazar/emoji-kitchen](https://github.com/xsalazar/emoji-kitchen).
Images are hot-linked from Google's CDN and never redistributed; the packed index
holds only factual pair data — which combinations exist and when they shipped.

Faces mode uses cut-up Twemoji parts from
[Ryhon0/open-emoji-mash](https://github.com/Ryhon0/open-emoji-mash) (GPL-3.0),
fetched from jsDelivr at a pinned commit. Twemoji artwork © Twitter, CC-BY 4.0.
The technique comes from Louan Bengmah's
[Emoji Mashup Bot](https://knowyourmeme.com/memes/sites/emoji-mashup-bot).

## Licence

[GPL-3.0-or-later](./LICENSE), matching Vencord.
