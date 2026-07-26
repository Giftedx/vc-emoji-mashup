# Changelog

Notable changes, newest first. Versions are tagged and mirrored on the
[releases page](https://github.com/Giftedx/vc-emoji-mashup/releases).

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

[0.1.0]: https://github.com/Giftedx/vc-emoji-mashup/releases/tag/v0.1.0
