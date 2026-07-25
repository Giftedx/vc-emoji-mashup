/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Regenerates kitchenData.ts from the upstream Emoji Kitchen metadata.
 *
 * Run manually — never at runtime:
 *   pnpm build-index
 *
 * The upstream file is ~94 MB of JSON, almost all of it derivable. This strips it
 * to (loIndex, hiIndex, dateIndex, orientation) per pair plus the emoji/name/date
 * tables: 783 KB packed, 375 KB gzipped, 500 KB as the base64 constant.
 *
 * Set METADATA_PATH to reuse a local copy instead of downloading.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { encodeIndex, type PairRecord, type RawIndex } from "../codec";
import { createKitchen } from "../kitchen";

const SOURCE_REF = "9d2d8eb9281702bd7fdc3ee583a0fa49343a7ae7";
const SOURCE = `https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/${SOURCE_REF}/app/metadata.json`;
const CACHE = process.env.METADATA_PATH ?? "metadata.json";
const OUT = "kitchenData.ts";

const EXPECTED_EMOJI = 619;
const MIN_PAIRS = 140_000;
const MAX_DATES = 128; // dateIndex is 7 bits
const URL_SAMPLE = 20;
const URL_SAMPLE_MIN_OK = 18;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const HEAD_TIMEOUT_MS = 10_000;

interface UpstreamCombo {
    leftEmojiCodepoint: string;
    rightEmojiCodepoint: string;
    date: string;
    isLatest: boolean;
}

interface UpstreamEntry {
    alt: string;
    keywords?: string[];
    category?: string;
    subcategory?: string;
    combinations?: Record<string, UpstreamCombo[]>;
}

interface Upstream {
    knownSupportedEmoji: string[];
    data: Record<string, UpstreamEntry>;
}

interface LoadedMetadata {
    metadata: Upstream;
    sha256: string;
}

function parseMetadata(text: string): LoadedMetadata {
    return {
        metadata: JSON.parse(text) as Upstream,
        sha256: createHash("sha256").update(text).digest("hex")
    };
}

async function loadMetadata(): Promise<LoadedMetadata> {
    if (existsSync(CACHE)) {
        console.log(`using cached metadata at ${CACHE}`);
        return parseMetadata(readFileSync(CACHE, "utf8"));
    }

    console.log("downloading metadata (~94 MB)...");
    const res = await fetch(SOURCE, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);

    const text = await res.text();
    writeFileSync(CACHE, text);
    console.log(`cached to ${CACHE}`);
    return parseMetadata(text);
}

const { metadata: meta, sha256: sourceSha256 } = await loadMetadata();

const emoji = meta.knownSupportedEmoji;
const indexOf = new Map<string, number>(emoji.map((e, i) => [e, i]));

const names = emoji.map(cp => {
    const entry = meta.data[cp];
    if (!entry) throw new Error(`no data entry for supported emoji ${cp}`);
    return [
        entry.alt,
        (entry.keywords ?? []).join(","),
        entry.category ?? "",
        entry.subcategory ?? ""
    ].join("\t");
});

// Collect one record per unordered pair, keeping the date string for now —
// the date table cannot be indexed until it is complete and sorted.
interface Draft { lo: number; hi: number; date: string; loIsUrlLeft: boolean; }

const drafts = new Map<number, Draft>();
const dateSet = new Set<string>();
let skipped = 0;

for (const entry of Object.values(meta.data)) {
    for (const combos of Object.values(entry.combinations ?? {})) {
        for (const c of combos) {
            if (!c.isLatest) continue;

            const li = indexOf.get(c.leftEmojiCodepoint);
            const ri = indexOf.get(c.rightEmojiCodepoint);
            if (li === undefined || ri === undefined) { skipped++; continue; }

            const lo = Math.min(li, ri);
            const hi = Math.max(li, ri);
            const key = lo * 65536 + hi;
            if (drafts.has(key)) continue;

            dateSet.add(c.date);
            drafts.set(key, { lo, hi, date: c.date, loIsUrlLeft: li === lo });
        }
    }
}

const dates = [...dateSet].sort();
const dateIndexOf = new Map(dates.map((d, i) => [d, i]));

const pairs: PairRecord[] = [...drafts.values()]
    .sort((a, b) => a.lo - b.lo || a.hi - b.hi)
    .map(d => ({
        lo: d.lo,
        hi: d.hi,
        dateIndex: dateIndexOf.get(d.date)!,
        loIsUrlLeft: d.loIsUrlLeft
    }));

// Invariants: fail the build rather than ship a broken index.
if (emoji.length !== EXPECTED_EMOJI) {
    throw new Error(`emoji count ${emoji.length}, expected ${EXPECTED_EMOJI} — upstream changed, re-verify the design`);
}
if (pairs.length < MIN_PAIRS) {
    throw new Error(`only ${pairs.length} pairs, expected at least ${MIN_PAIRS}`);
}
if (dates.length > MAX_DATES) {
    throw new Error(`${dates.length} dates exceeds the ${MAX_DATES}-entry limit of the 7-bit date index`);
}
if (pairs.some(p => p.dateIndex === undefined)) {
    throw new Error("some pairs never received a date index");
}

const raw: RawIndex = { emoji, names, dates, pairs };

// Verify the URL rule against live gstatic before writing anything.
const kitchen = createKitchen(raw);
const sample = Array.from({ length: URL_SAMPLE }, (_, i) => pairs[Math.floor(i * pairs.length / URL_SAMPLE)]);

let ok = 0;
for (const p of sample) {
    const url = kitchen.urlFor(emoji[p.lo], emoji[p.hi]);
    if (!url) throw new Error(`urlFor returned null for a pair that is in the index: ${p.lo},${p.hi}`);

    const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS)
    });
    if (res.ok) ok++;
    else console.warn(`  ${res.status}: ${url}`);
}
console.log(`live URL check: ${ok}/${URL_SAMPLE}`);
if (ok < URL_SAMPLE_MIN_OK) {
    throw new Error(`only ${ok}/${URL_SAMPLE} sampled URLs resolve — the URL rule may have changed upstream`);
}

const packed = encodeIndex(raw);
const gz = gzipSync(packed, { level: 9 });
const b64 = gz.toString("base64");

writeFileSync(OUT,
    `/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// GENERATED by scripts/build-index.mts — do not edit by hand.
//
// Source:    ${SOURCE}
// Source ref:${SOURCE_REF}
// SHA-256:   ${sourceSha256}
// Emoji Kitchen artwork (c) Google. Pair metadata from xsalazar/emoji-kitchen.
// Contents:  emoji=${emoji.length} pairs=${pairs.length} dates=${dates.length}
// Size:      packed=${(packed.length / 1024).toFixed(1)} KB gzip=${(gz.length / 1024).toFixed(1)} KB

export const INDEX_SOURCE_REF = "${SOURCE_REF}";
export const INDEX_SOURCE_SHA256 = "${sourceSha256}";
export const INDEX_B64 =
    "${b64}";
`);

console.log(`emoji=${emoji.length} pairs=${pairs.length} dates=${dates.length} skipped=${skipped}`);
console.log(`packed=${(packed.length / 1024).toFixed(1)} KB  gzip=${(gz.length / 1024).toFixed(1)} KB  b64=${(b64.length / 1024).toFixed(1)} KB`);
console.log(`wrote ${OUT}`);
