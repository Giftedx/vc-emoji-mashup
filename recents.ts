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

export async function getRecents(): Promise<Recent[]> {
    const current = await DataStore.get<Recent[]>(KEY);
    if (current !== undefined) return current;

    // Preserve recents for existing installs after the plugin's working name
    // changed. The next successful push writes the combined list to KEY.
    return (await DataStore.get<Recent[]>(LEGACY_KEY)) ?? [];
}

/** Most-recent-first, de-duplicated by URL, capped at LIMIT. */
export function mergeRecent(list: readonly Recent[], recent: Recent): Recent[] {
    return [recent, ...list.filter(r => r.url !== recent.url)].slice(0, LIMIT);
}

/** Most-recent-first, de-duplicated by URL, capped at LIMIT. */
export async function pushRecent(recent: Recent): Promise<void> {
    await DataStore.set(KEY, mergeRecent(await getRecents(), recent));
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
