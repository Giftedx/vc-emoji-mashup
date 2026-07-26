/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

export interface Recent {
    left: string;
    right: string;
    url: string;
}

const KEY = "EmojiMashup_recents";
const LEGACY_KEY = "dismoji-recents";
const LIMIT = 24;

/**
 * DataStore is typed by assertion, not validation, so anything could be sitting
 * under these keys. An unusable value renders straight into the Recent row and
 * takes the whole picker down with it, so it is filtered to entries that
 * actually have the three string fields, and capped — a legacy list predates
 * LIMIT and can be longer.
 */
function sanitise(value: unknown): Recent[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter((r): r is Recent =>
            typeof r?.left === "string" && typeof r?.right === "string" && typeof r?.url === "string")
        .slice(0, LIMIT);
}

export async function getRecents(): Promise<Recent[]> {
    const current = await DataStore.get<unknown>(KEY);
    if (current !== undefined) return sanitise(current);

    // Preserve recents for existing installs after the plugin's working name
    // changed. The next successful push writes the combined list to KEY.
    return sanitise(await DataStore.get<unknown>(LEGACY_KEY));
}

/** Most-recent-first, de-duplicated by URL, capped at LIMIT. */
export function mergeRecent(list: readonly Recent[], recent: Recent): Recent[] {
    return [recent, ...list.filter(r => r.url !== recent.url)].slice(0, LIMIT);
}

/**
 * Serialises the read-modify-write, because picks are fired without awaiting
 * (MashupPicker calls pickAndRemember with void). Two quick clicks would
 * otherwise both read the pre-click list and the second write would drop the
 * first pick — invisibly, since the picker's own state already shows it.
 */
let queue: Promise<unknown> = Promise.resolve();

/** Most-recent-first, de-duplicated by URL, capped at LIMIT. */
export function pushRecent(recent: Recent): Promise<void> {
    const next = queue.then(
        async () => DataStore.set(KEY, mergeRecent(await getRecents(), recent))
    );

    // A failed write must not wedge every later one, so the chain continues
    // from a settled promise while the caller still sees the rejection.
    queue = next.catch(() => {});
    return next;
}

/**
 * The user's pick is the primary action; recents persistence is best-effort.
 * A local datastore failure must never turn a valid mashup click into a no-op.
 */
export async function pickAndRemember(
    recent: Recent,
    pick: (url: string) => void,
    remember: (recent: Recent) => Promise<void> = pushRecent,
    reportError: (error: unknown) => void = error => console.error("[EmojiMashup] could not save recent", error)
): Promise<void> {
    pick(recent.url);

    try {
        await remember(recent);
    } catch (error) {
        reportError(error);
    }
}
