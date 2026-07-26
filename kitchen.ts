/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RawIndex } from "./codec";

export interface Mashup {
    /** Codepoint of the other emoji in the pair. */
    partner: string;
    /** Fully-built gstatic asset URL. */
    url: string;
    /** Alt text of the partner emoji. */
    name: string;
}

export interface Kitchen {
    /** Every supported emoji codepoint, in dataset order. */
    emoji: string[];
    nameOf(codepoint: string): string;
    categoryOf(codepoint: string): string;
    partnersOf(codepoint: string): Mashup[];
    urlFor(a: string, b: string): string | null;
    search(query: string): string[];
}

const BASE = "https://www.gstatic.com/android/keyboard/emojikitchen";

const ALT = 0;
const KEYWORDS = 1;
const CATEGORY = 2;

/**
 * Every codepoint *component* takes its own `u` prefix:
 *   "2615"             -> "u2615"
 *   "263a-fe0f"        -> "u263a-ufe0f"
 *   "1f62e-200d-1f4a8" -> "u1f62e-u200d-u1f4a8"
 *
 * The naive `u${codepoint}` form matches only 75.9% of real pairs.
 */
export function toUrlSegment(codepoint: string): string {
    return codepoint.split("-").map(c => "u" + c).join("-");
}

export function buildUrl(date: string, left: string, right: string): string {
    const l = toUrlSegment(left);
    return `${BASE}/${date}/${l}/${l}_${toUrlSegment(right)}.png`;
}

/**
 * Converts a dataset codepoint into the actual emoji character:
 *   "2615"             -> "☕"
 *   "263a-fe0f"        -> "☺️"
 *   "1f62e-200d-1f4a8" -> "😮‍💨"
 *
 * Stage 1 renders these as text rather than images. Discord exposes no
 * addressable image URL for unicode emoji (IconUtils.getEmojiURL covers custom
 * emoji only), and text costs no network request and no CSP allowance.
 */
export function toEmojiChar(codepoint: string): string {
    return String.fromCodePoint(...codepoint.split("-").map(c => Number.parseInt(c, 16)));
}

export function createKitchen(raw: RawIndex): Kitchen {
    const indexOf = new Map<string, number>();
    for (let i = 0; i < raw.emoji.length; i++) indexOf.set(raw.emoji[i], i);

    // adjacency[i] = indices into raw.pairs of every pair touching emoji i.
    //
    // Self-pairs (coffee + coffee) are real in this dataset and have lo === hi.
    // Pushing such a pair twice would duplicate it in partnersOf — a doubled cell
    // and a duplicate React key — so it is pushed once.
    const adjacency: number[][] = Array.from({ length: raw.emoji.length }, () => []);
    for (let i = 0; i < raw.pairs.length; i++) {
        const p = raw.pairs[i];
        adjacency[p.lo].push(i);
        if (p.hi !== p.lo) adjacency[p.hi].push(i);
    }

    function urlOfPair(pairIndex: number): string {
        const p = raw.pairs[pairIndex];
        const lo = raw.emoji[p.lo];
        const hi = raw.emoji[p.hi];
        const date = raw.dates[p.dateIndex];
        return p.loIsUrlLeft ? buildUrl(date, lo, hi) : buildUrl(date, hi, lo);
    }

    function field(emojiIndex: number, which: number): string {
        const row = raw.names[emojiIndex];
        return row === undefined ? "" : (row.split("\t")[which] ?? "");
    }

    const altCache = new Array(raw.emoji.length);
    const keywordCache = new Array(raw.emoji.length);
    for (let i = 0; i < raw.emoji.length; i++) {
        altCache[i] = field(i, ALT).toLowerCase();
        const kw = field(i, KEYWORDS);
        keywordCache[i] = kw ? kw.toLowerCase().split(",") : [];
    }

    const partnersCache: Mashup[][] = new Array(raw.emoji.length);

    function findPair(a: string, b: string): number | null {
        const ia = indexOf.get(a);
        const ib = indexOf.get(b);
        if (ia === undefined || ib === undefined) return null;

        const lo = Math.min(ia, ib);
        const hi = Math.max(ia, ib);
        for (const pi of adjacency[lo]) {
            const p = raw.pairs[pi];
            if (p.lo === lo && p.hi === hi) return pi;
        }
        return null;
    }

    return {
        emoji: raw.emoji,

        nameOf(codepoint) {
            const i = indexOf.get(codepoint);
            return i === undefined ? "" : field(i, ALT);
        },

        categoryOf(codepoint) {
            const i = indexOf.get(codepoint);
            return i === undefined ? "" : field(i, CATEGORY);
        },

        partnersOf(codepoint) {
            const i = indexOf.get(codepoint);
            if (i === undefined) return [];

            if (partnersCache[i]) return partnersCache[i];

            return partnersCache[i] = adjacency[i].map(pi => {
                const p = raw.pairs[pi];
                const other = p.lo === i ? p.hi : p.lo;
                return {
                    partner: raw.emoji[other],
                    url: urlOfPair(pi),
                    name: field(other, ALT)
                };
            });
        },

        urlFor(a, b) {
            const pi = findPair(a, b);
            return pi === null ? null : urlOfPair(pi);
        },

        search(query) {
            const q = query.trim().toLowerCase();
            if (!q) return [];

            const hits: string[] = [];
            for (let i = 0; i < raw.emoji.length; i++) {
                const alt = altCache[i];
                if (alt.includes(q)) {
                    hits.push(raw.emoji[i]);
                    continue;
                }
                const keywords = keywordCache[i];
                if (keywords.some(k => k.includes(q))) {
                    hits.push(raw.emoji[i]);
                }
            }
            return hits;
        }
    };
}
