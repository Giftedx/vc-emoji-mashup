<!-- What changes, and why. -->

## Checks

- [ ] `pnpm check` passes (typecheck + tests)
- [ ] The build, the typecheck and the lint pass inside a Vencord checkout (`pnpm build`, `pnpm testTsc`, eslint), or CI's host job passes
- [ ] If you regenerated `kitchenIndex.b64`: repin `INDEX_PIN` in `loadKitchen.ts` to the commit that carries the new index
