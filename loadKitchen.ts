/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { decodeIndex } from "./codec";
import { createKitchen, type Kitchen } from "./kitchen";
import { INDEX_B64 } from "./kitchenData";

let cached: Promise<Kitchen> | null = null;

/**
 * Decompresses the bundled index and builds the adjacency map.
 *
 * Called on first tab open rather than at plugin start — there is no reason to
 * charge users who never open the picker. Memoised, so subsequent opens are free.
 */
export function loadKitchen(): Promise<Kitchen> {
    cached ??= (async () => {
        const gz = Uint8Array.from(atob(INDEX_B64), c => c.charCodeAt(0));
        const stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"));
        const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        return createKitchen(decodeIndex(bytes));
    })();

    return cached;
}

/** Test seam: drops the memoised instance. */
export function resetKitchenCache(): void {
    cached = null;
}
