<!-- What changes, and why. -->

## Checks

- [ ] `pnpm test` and `pnpm typecheck` pass
- [ ] Build, typecheck and lint pass inside a Vencord checkout (`pnpm build`, `pnpm testTsc`, eslint) — or CI's host job is green
- [ ] If `kitchenIndex.b64` was regenerated: `INDEX_PIN` in `loadKitchen.ts` repinned to the commit that carries the new index
