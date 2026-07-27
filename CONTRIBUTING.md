# Contributing

Open an issue before you write anything that is not trivial. Keep each change
small. Confirm that the gates below pass.

## Setup

Read [Installation](./README.md#installation) first. It explains why you must
**clone, not link**, into `src/userplugins`, and why this repository names its
tsconfig `tsconfig.dev.json` instead of overriding Vencord's. Those two points
account for most broken installations.

[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) has the rest: the full gate list and
how to regenerate the packed index. It also gives the design rationale behind the
patch and the fetched index.

## Before you open a PR

```bash
pnpm check         # typecheck + tests, run before every push
```

`index.tsx` and `MashupPicker.tsx` are outside the local typecheck on purpose. A
build inside a Vencord checkout covers them (`pnpm build`, `pnpm testTsc`, eslint),
and CI's host job repeats that build against current Vencord.

If you regenerate `kitchenIndex.b64`, commit it and repin `INDEX_PIN` in
`loadKitchen.ts` to that commit. `pnpm test` fails if the index and its recorded
digest differ.

## Commit style

Write `type: lowercase summary`. The types in use are `feat`, `fix`, `docs`, `ci`,
`style`, `refactor` and `chore`. Examine `git log --oneline` and match it.
