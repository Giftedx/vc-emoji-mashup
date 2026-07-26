/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { decodeIndex } from "./codec";
import { createKitchen, type Kitchen } from "./kitchen";
import { INDEX_SHA256 } from "./kitchenIndexMeta";

/**
 * The commit holding kitchenIndex.b64.
 *
 * Pinned to a commit rather than a branch so a later regeneration cannot change
 * what an already-installed copy loads. Repin after committing a new index —
 * build-index prints a reminder, and the digest check below fails loudly if the
 * pin and the expected digest ever disagree.
 */
const INDEX_PIN = "08e156d61fe0e301d54a059c9045e3aea7cc3dfc";

/**
 * jsDelivr rather than raw.githubusercontent, matching how this plugin already
 * pins its Twemoji parts, and it is a CDN built for this.
 */
export const INDEX_URL = `https://cdn.jsdelivr.net/gh/Giftedx/vc-emoji-mashup@${INDEX_PIN}/kitchenIndex.b64`;

let cached: Promise<Kitchen> | null = null;

async function assertExpectedIndex(b64: string): Promise<void> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(b64));
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");

    if (actual !== INDEX_SHA256) {
        throw new Error(`EmojiMashup: the fetched index digest ${actual} does not match the expected ${INDEX_SHA256}`);
    }
}

/**
 * Builds the adjacency map from a base64 gzipped index.
 *
 * Takes its source as an argument so tests and repository scripts can read the
 * committed file directly instead of going over the network for data that is
 * sitting on disk.
 */
export async function buildKitchen(readIndex: () => Promise<string>): Promise<Kitchen> {
    const b64 = (await readIndex()).trim();
    await assertExpectedIndex(b64);

    const gz = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());

    return createKitchen(decodeIndex(bytes));
}

/**
 * Fetches and decodes the index.
 *
 * Fetched rather than bundled: compiled in, the payload would be by far the
 * largest file Vencord ships and every user would download it whether or not
 * they enable this plugin. Called on first tab open, so only people who open
 * the picker pay for it, and memoised so later opens are free.
 */
export function loadKitchen(): Promise<Kitchen> {
    // A rejected promise is not nullish, so ??= alone would memoise a failure
    // for the lifetime of the client: open the picker once while offline and
    // Kitchen mode stays broken until Discord restarts. Clearing the slot on
    // rejection makes the next open retry.
    cached ??= buildKitchen(async () => {
        const response = await fetch(INDEX_URL);
        if (!response.ok) {
            throw new Error(`EmojiMashup: could not fetch the mashup index (${response.status} ${response.statusText})`);
        }
        return response.text();
    }).catch(error => {
        cached = null;
        throw error;
    });

    return cached;
}
