/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Confirms the generated part URLs actually resolve on the CDN.
 *
 * The Emoji Kitchen URL rule looked correct and silently 404'd on a quarter of
 * pairs; only checking against live assets caught it. Same discipline here.
 *
 *   pnpm verify-parts
 */

import { followers, leaders, partsFor } from "../twemojiMash";

const leadList = leaders();
const followList = followers();
const SAMPLE = 25;

console.log(`leaders=${leadList.length} followers=${followList.length}`);

const pairs = Array.from({ length: SAMPLE }, (_, i) => [
    leadList[Math.floor(i * leadList.length / SAMPLE)],
    followList[Math.floor(((i * 7) % SAMPLE) * followList.length / SAMPLE)]
] as const);

let checked = 0;
let failed = 0;

for (const [a, b] of pairs) {
    const parts = partsFor(a, b);
    if (!parts) {
        console.warn(`  no parts for ${a} + ${b}`);
        failed++;
        continue;
    }

    for (const [layer, url] of Object.entries(parts)) {
        checked++;
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) {
            console.warn(`  ${res.status} ${layer}: ${url}`);
            failed++;
        }
    }
}

console.log(`${checked - failed}/${checked} layer URLs resolve`);

if (failed > 0) {
    throw new Error(`${failed} part URLs did not resolve — the layout or pinned ref is wrong`);
}
console.log("all sampled part URLs resolve");
