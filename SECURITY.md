# Security

This plugin runs entirely inside the Discord client. It has no server component
and handles no credentials.

What it does touch:

- Fetches the packed Kitchen index and Twemoji parts inventory from jsDelivr at
  **commit-pinned** URLs; the index's SHA-256 is verified before it is decoded.
- Hot-links mashup images from `www.gstatic.com`, behind Vencord's own host
  permission prompt.
- Stores recents and settings in Vencord's local DataStore.

To report a vulnerability, use GitHub's
[private vulnerability reporting](https://github.com/Giftedx/vc-emoji-mashup/security/advisories/new)
rather than a public issue.
