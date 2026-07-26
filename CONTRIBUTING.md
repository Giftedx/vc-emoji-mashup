# Contributing

Open an issue before writing anything non-trivial, keep changes small, and make
sure the gates below are green.

## Setup

Everything about the development setup — including why you must **clone, not
symlink** into `src/userplugins`, and why the tsconfig is named
`tsconfig.dev.json` — lives in the [Development](./README.md#development)
section of the README. Read it first; those two gotchas account for most broken
setups.

## Before opening a PR

```bash
pnpm test          # unit + integration tests
pnpm typecheck     # the Vencord-independent code
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
