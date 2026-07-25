/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import * as kitchenData from "../kitchenData";

describe("generated index provenance", () => {
    it("records an immutable source revision and content digest", () => {
        const data = kitchenData as typeof kitchenData & {
            INDEX_SOURCE_REF?: string;
            INDEX_SOURCE_SHA256?: string;
        };

        expect(data.INDEX_SOURCE_REF).toMatch(/^[0-9a-f]{40}$/);
        expect(data.INDEX_SOURCE_SHA256).toMatch(/^[0-9a-f]{64}$/);
    });
});
