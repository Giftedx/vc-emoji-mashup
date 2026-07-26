/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * A source clone lives below Vencord's `src/`, so Vencord's root TypeScript
 * project sees this repository's development tests too. Vencord does not depend
 * on Vitest; these deliberately loose declarations keep its host typecheck
 * focused on plugin compatibility while this repository's own typecheck and
 * Vitest installation provide the real test types.
 */
declare module "vitest" {
    export const afterEach: any;
    export const beforeAll: any;
    export const beforeEach: any;
    export const describe: any;
    export const expect: any;
    export const it: any;
    export const vi: any;
}

declare module "vitest/config" {
    export function defineConfig(config: any): any;
}
