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

const KEY = "dismoji-recents";
const LIMIT = 24;

export async function getRecents(): Promise<Recent[]> {
    return (await DataStore.get<Recent[]>(KEY)) ?? [];
}

/** Most-recent-first, de-duplicated by URL, capped at LIMIT. */
export async function pushRecent(recent: Recent): Promise<void> {
    const list = (await getRecents()).filter(r => r.url !== recent.url);
    list.unshift(recent);
    await DataStore.set(KEY, list.slice(0, LIMIT));
}
