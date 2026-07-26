/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("loadKitchen memoisation", () => {
    // Each case needs a fresh module, since the memo lives at module scope.
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllGlobals());

    it("fetches once when the load succeeds", async () => {
        const { readFile } = await import("node:fs/promises");
        const b64 = await readFile(new URL("../kitchenIndex.b64", import.meta.url), "utf8");
        const fetchMock = vi.fn(async () => new Response(b64, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const { loadKitchen } = await import("../loadKitchen");

        const first = await loadKitchen();
        const second = await loadKitchen();

        expect(second).toBe(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries after a failure instead of memoising the rejection", async () => {
        // A rejected promise is not nullish, so a bare ??= would keep serving
        // the first failure and leave Kitchen mode broken until Discord
        // restarts — even once the network is back.
        const fetchMock = vi.fn(async () => {
            throw new Error("offline");
        });
        vi.stubGlobal("fetch", fetchMock);

        const { loadKitchen } = await import("../loadKitchen");

        await expect(loadKitchen()).rejects.toThrow("offline");
        await expect(loadKitchen()).rejects.toThrow("offline");

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
