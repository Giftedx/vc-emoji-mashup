# Changelog

Notable changes, newest first. Versions are tagged and mirrored on the
[releases page](https://github.com/Giftedx/vc-emoji-mashup/releases).

## [0.1.1] — 2026-07-26

### Fixed

- Faces mode offered 128 of the 129 available mouths. `followers()` filtered the
  *leader* list, which additionally requires a base shape, so 😚 — whose mouth
  exists upstream and composites correctly — never appeared in the grid.
- A failed index fetch was memoised for the lifetime of the client: opening the
  picker once while offline left Kitchen mode broken until Discord restarted,
  because a rejected promise is not nullish and `??=` kept serving it.
- Sending a generated face could hang forever on a stalled connection, since an
  image that never loads fires neither `onload` nor `onerror` — the picker
  stayed open with no upload prompt and no failure toast. Layer loads time out
  at ten seconds now.
- Generated previews requested without CORS while the renderer requested with
  it, so the two never shared a cache entry and every send re-fetched all three
  layers, failing outright if the network had dropped meanwhile.
- Two picks in quick succession could lose the first: recents did an
  un-serialised read-modify-write, so the second write erased the first.
- Junk stored under the recents key crashed the entire picker rather than the
  Recent row, because the stored value was cast rather than checked.
- The encoder checked that a date index *fit* its 7-bit field but not that it
  named a row, and never bounds-checked pair indices or the emoji count against
  the 16-bit fields they are written to. Unreachable through the current
  generator, but the codec is the wire format's only authority.

- Mashup cells announced only the partner emoji to screen readers — a non-empty
  image `alt` outranks the button's `title` when the accessible name is
  computed, so the emoji the pair was built from was dropped.
- Loading, error and empty-result messages are swapped in asynchronously with
  no live region, so a screen reader user heard nothing. They are `role=status`.
- The Back button's `‹` was read out by its Unicode name; it is decorative now.
- Declining the preview permission changed nothing and reported nothing, and a
  second permission dialog could be queued behind the first.
- The grid could collapse to zero height at large text sizes, because every
  other row in the picker is fixed-height and the root hides overflow.

## [0.1.0] — 2026-07-26

Initial release.

- **Mashup tab** in Discord's expression picker, added by a webpack patch that
  Vencord undoes cleanly if Discord reships the module.
- **Kitchen engine** — Google's Emoji Kitchen, 147,000 combinations across 619
  emoji. The packed index (375 KB gzipped, from ~94 MB of upstream metadata) is
  fetched on first open from a commit-pinned jsDelivr URL and SHA-256-verified
  before decoding; sent as a URL Discord embeds server-side.
- **Faces engine** — Emoji Mashup Bot-style composites built at runtime from
  cut-up Twemoji (135 × 128 ordered pairs), uploaded as an image attachment.
- Search, category filter, a Recent row remembering the last 24 mashups, and
  Twitter/Google/system emoji-set rendering for the picker grid.
- Deterministic release gate: unit + integration tests, build/typecheck/lint
  inside current Vencord, live asset verification, and a weekly check that the
  patch still applies to Discord's live bundle.

[0.1.1]: https://github.com/Giftedx/vc-emoji-mashup/releases/tag/v0.1.1
[0.1.0]: https://github.com/Giftedx/vc-emoji-mashup/releases/tag/v0.1.0
