/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { INDEX_SHA256, INDEX_SOURCE_REF, INDEX_SOURCE_SHA256 } from "../kitchenIndexMeta";

const indexPath = resolve(import.meta.dirname, "..", "kitchenIndex.b64");

describe("generated index provenance", () => {
    it("records an immutable source revision and content digest", () => {
        expect(INDEX_SOURCE_REF).toMatch(/^[0-9a-f]{40}$/);
        expect(INDEX_SOURCE_SHA256).toMatch(/^[0-9a-f]{64}$/);
        expect(INDEX_SHA256).toMatch(/^[0-9a-f]{64}$/);
    });

    // The payload is fetched at runtime and checked against INDEX_SHA256, so
    // the two drifting apart would break the picker for everyone. Regenerating
    // one without the other is the way that happens.
    it("matches the digest of the committed index", () => {
        const b64 = readFileSync(indexPath, "utf8").trim();
        expect(createHash("sha256").update(b64).digest("hex")).toBe(INDEX_SHA256);
    });
});
