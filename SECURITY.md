# Security

This plugin runs inside the Discord client only. It has no server component, and it
handles no credentials.

What the plugin does touch:

- It fetches the packed Kitchen index and the Twemoji parts inventory from jsDelivr
  at **commit-pinned** URLs. It verifies the SHA-256 of the index before it decodes
  the index.
- It links to mashup images on `www.gstatic.com`, behind Vencord's own host
  permission prompt.
- It stores the recents and the settings in Vencord's local DataStore.

To report a vulnerability, use GitHub's
[private vulnerability reporting](https://github.com/Giftedx/vc-emoji-mashup/security/advisories/new)
instead of a public issue.
