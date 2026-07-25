/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Checks every external runtime asset boundary with finite request timeouts:
 * bundled Emoji Kitchen URLs, generated face layers, Twemoji and Noto.
 *
 *   pnpm verify-assets
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { emojiAssetUrls, type EmojiSet } from "../emojiSets";
import { buildKitchen, INDEX_URL } from "../loadKitchen";
import { followers, leaders, partsFor } from "../twemojiMash";

const TIMEOUT_MS = 10_000;
const KITCHEN_SAMPLE = 20;
const PART_SAMPLE = 25;

interface CheckResult {
    label: string;
    url: string;
    ok: boolean;
    detail: string;
}

type Check = () => Promise<CheckResult>;

async function runChecks(checks: readonly Check[], concurrency: number): Promise<CheckResult[]> {
    const results = new Array<CheckResult>(checks.length);
    let next = 0;

    async function worker() {
        while (next < checks.length) {
            const index = next++;
            results[index] = await checks[index]();
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, checks.length) }, worker));
    return results;
}

async function head(label: string, url: string, requireCors = false): Promise<CheckResult> {
    try {
        const response = await fetch(url, {
            method: "HEAD",
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        const cors = response.headers.get("access-control-allow-origin");
        const corsOk = !requireCors || cors === "*";
        return {
            label,
            url,
            ok: response.ok && corsOk,
            detail: response.ok
                ? corsOk ? `${response.status}` : `${response.status}, missing Access-Control-Allow-Origin: *`
                : `${response.status} ${response.statusText}`
        };
    } catch (error) {
        return {
            label,
            url,
            ok: false,
            detail: error instanceof Error ? error.message : String(error)
        };
    }
}

async function checkCandidateSet(set: Exclude<EmojiSet, "system">, codepoint: string): Promise<CheckResult> {
    const candidates = emojiAssetUrls(set, codepoint);
    const attempts: CheckResult[] = [];

    for (const url of candidates) {
        const result = await head(`${set}:${codepoint}`, url);
        attempts.push(result);
        if (result.ok) return result;
    }

    return {
        label: `${set}:${codepoint}`,
        url: candidates.join(" | "),
        ok: false,
        detail: attempts.map(result => result.detail).join("; ")
    };
}

const checks: Check[] = [];

// From disk, so this verifies the index about to ship rather than the published
// one. The pinned URL that ships it is checked separately below.
const kitchen = await buildKitchen(async () =>
    readFileSync(resolve(import.meta.dirname, "..", "kitchenIndex.b64"), "utf8"));

// The index is now fetched at runtime, so its pin is a runtime asset boundary
// like any other: a bad pin means an empty Kitchen grid for everyone.
checks.push(() => head("index:pinned", INDEX_URL));

for (let i = 0; i < KITCHEN_SAMPLE; i++) {
    const emojiIndex = Math.floor(i * kitchen.emoji.length / KITCHEN_SAMPLE);
    const codepoint = kitchen.emoji[emojiIndex];
    const partners = kitchen.partnersOf(codepoint);
    const partner = partners[Math.floor((i * 17 % KITCHEN_SAMPLE) * partners.length / KITCHEN_SAMPLE)];
    checks.push(() => head(`kitchen:${codepoint}+${partner.partner}`, partner.url));
}

const leadList = leaders();
const followList = followers();
for (let i = 0; i < PART_SAMPLE; i++) {
    const leader = leadList[Math.floor(i * leadList.length / PART_SAMPLE)];
    const follower = followList[Math.floor(((i * 7) % PART_SAMPLE) * followList.length / PART_SAMPLE)];
    const parts = partsFor(leader, follower);
    if (!parts) {
        checks.push(async () => ({
            label: `parts:${leader}+${follower}`,
            url: "",
            ok: false,
            detail: "partsFor returned null"
        }));
        continue;
    }

    for (const [layer, url] of Object.entries(parts)) {
        checks.push(() => head(`parts:${layer}:${leader}+${follower}`, url, true));
    }
}

for (const codepoint of ["1f600", "263a-fe0f", "1f642-200d-2195-fe0f"]) {
    checks.push(() => checkCandidateSet("twitter", codepoint));
    checks.push(() => checkCandidateSet("google", codepoint));
}

const results = await runChecks(checks, 8);
const failed = results.filter(result => !result.ok);
const counts = new Map<string, number>();
for (const result of results) {
    const group = result.label.split(":")[0];
    counts.set(group, (counts.get(group) ?? 0) + 1);
}

console.log([...counts].map(([group, count]) => `${group}=${count}`).join(" "));
console.log(`${results.length - failed.length}/${results.length} external asset checks passed`);

for (const result of failed) {
    console.error(`FAIL ${result.label}: ${result.detail} ${result.url}`);
}

if (failed.length > 0) {
    throw new Error(`${failed.length} external asset checks failed`);
}
