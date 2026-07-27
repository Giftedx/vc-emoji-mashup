# Changelog

The notable changes, newest first. Each version is tagged, and the
[releases page](https://github.com/Giftedx/vc-emoji-mashup/releases) mirrors them.

## [0.1.1] — 2026-07-26

### Fixed

- Faces mode offered 128 of the 129 available mouths. `followers()` filtered the
  *leader* list, which also requires a base shape, so 😚 never appeared in the
  grid. Its mouth exists upstream and composites correctly.
- A failed index fetch was memoised for the life of the client. If you opened the
  picker once while offline, Kitchen mode stayed broken until Discord restarted,
  because a rejected promise is not nullish and `??=` kept serving it.
- Sending a generated face could hang forever on a stalled connection. An image
  that never loads fires neither `onload` nor `onerror`, so the picker stayed open
  with no upload prompt and no failure toast. Layer loads now time out at ten
  seconds.
- Generated previews requested without CORS while the renderer requested with CORS.
  The two never shared a cache entry, so every send fetched all three layers again.
  A send failed outright if the network had dropped in the meantime.
- Two picks in quick succession could lose the first. The recents did a
  read-modify-write that was not serialised, so the second write erased the first.
- Junk stored under the recents key crashed the whole picker instead of the Recent
  row, because the stored value was cast instead of checked.
- The encoder checked that a date index *fit* its 7-bit field, but not that the
  index named a row. It also never checked the pair indices or the emoji count
  against the 16-bit fields they are written to. The current generator cannot reach
  this fault, but the codec is the only authority on the wire format.
- Mashup cells announced only the partner emoji to screen readers. A non-empty
  image `alt` outranks the button `title` when the accessible name is computed, so
  the emoji that the pair was built from was dropped.
- The loading, error and empty-result messages were swapped in asynchronously with
  no live region, so a screen reader user heard nothing. They are `role=status`
  now.
- The `‹` on the Back button was read out by its Unicode name. It is decorative
  now.
- Declining the preview permission changed nothing and reported nothing, and a
  second permission dialog could queue behind the first.
- The grid could collapse to zero height at large text sizes, because every other
  row in the picker has a fixed height and the root hides the overflow.

## [0.1.0] — 2026-07-26

Initial release.

- **Mashup tab** in Discord's expression picker, added by a webpack patch that
  Vencord undoes cleanly if Discord ships a new module.
- **Kitchen engine** — Google's Emoji Kitchen, 147,000 combinations across 619
  emoji. The packed index (375 KB gzipped, from ~94 MB of upstream metadata) is
  fetched at first open from a commit-pinned jsDelivr URL, and its SHA-256 is
  verified before decoding. Each mashup is sent as a URL that Discord embeds on the
  server.
- **Faces engine** — Emoji Mashup Bot-style composites built at runtime from
  cut-up Twemoji (135 × 128 ordered pairs), uploaded as an image attachment.
- Search, category filter, a Recent row that keeps the last 24 mashups, and
  Twitter/Google/system emoji-set rendering for the picker grid.
- Deterministic release gate: unit and integration tests, build/typecheck/lint
  inside current Vencord, live asset verification, and a weekly check that the
  patch still applies to Discord's live bundle.

[0.1.1]: https://github.com/Giftedx/vc-emoji-mashup/releases/tag/v0.1.1
[0.1.0]: https://github.com/Giftedx/vc-emoji-mashup/releases/tag/v0.1.0
