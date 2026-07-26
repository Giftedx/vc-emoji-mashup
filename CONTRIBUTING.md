# Contributing

Open an issue before writing anything non-trivial, keep changes small, and make
sure the gates below are green.

## Setup

Read [Installation](./README.md#installation) first — it explains why you must
**clone, not symlink** into `src/userplugins`, and why the tsconfig here is named
`tsconfig.dev.json` rather than shadowing Vencord's. Those two account for most
broken setups.

[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) has the rest: the full gate list,
regenerating the packed index, and the design rationale behind the patch and the
fetched index.

## Before opening a PR

```bash
pnpm check         # typecheck + tests; run this before every push
```

`index.tsx` and `MashupPicker.tsx` are deliberately outside the local typecheck;
they are covered by building inside a Vencord checkout (`pnpm build`,
`pnpm testTsc`, eslint), which CI's host job repeats against current Vencord.

If you regenerate `kitchenIndex.b64`, commit it and repin `INDEX_PIN` in
`loadKitchen.ts` to that commit — `pnpm test` fails if the index and its
recorded digest drift apart.

## Commit style

`type: lowercase summary` — the types in use are `feat`, `fix`, `docs`, `ci`,
`style`, `refactor` and `chore`. Look at `git log --oneline` and match it.
