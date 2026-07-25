/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Generated Twemoji face mashups — the second mashup engine.
 *
 * Where Emoji Kitchen is 147,000 hand-drawn images, these are composited at
 * runtime from cut-up Twemoji: a base shape, one emoji's eyes, another's mouth.
 * That is only meaningful for faces, so coverage is 135 usable emoji rather
 * than 619. A pair works when the leader has eyes and a base and the follower
 * has a mouth — 135 leaders x 128 followers — and order matters, so swapping
 * the two gives a genuinely different face.
 *
 * Parts come from Ryhon0/open-emoji-mash (GPL-3.0), pinned to a commit.
 */

import {
    HAS_EYES,
    HAS_MOUTH,
    HAS_OWN_BASE,
    PART_EMOJI,
    PARTS_BASE_URL,
    SHARED_BASE
} from "./twemojiParts";

export interface MashParts {
    /** Base shape, drawn first. */
    base: string;
    /** Eyes layer, from the first emoji. */
    eyes: string;
    /** Mouth layer, from the second emoji. */
    mouth: string;
}

/** Every emoji that can take part in a generated mashup. */
export const mashableEmoji: readonly string[] = PART_EMOJI;

/** An emoji can lead a mashup if it supplies both a base shape and eyes. */
export function canLead(codepoint: string): boolean {
    return HAS_EYES.has(codepoint) && (HAS_OWN_BASE.has(codepoint) || codepoint in SHARED_BASE);
}

/** An emoji can follow a mashup if it supplies a mouth. */
export function canFollow(codepoint: string): boolean {
    return HAS_MOUTH.has(codepoint);
}

/**
 * Resolves the base shape for an emoji.
 *
 * Shared bases come first: many faces reuse `regular`, `blush`, `cat` and so on,
 * and only the ones with distinctive shapes carry their own file.
 */
function baseUrl(codepoint: string): string | null {
    const shared = SHARED_BASE[codepoint];
    if (shared) return `${PARTS_BASE_URL}/base/shared/${shared}.svg`;
    if (HAS_OWN_BASE.has(codepoint)) return `${PARTS_BASE_URL}/base/${codepoint}.svg`;
    return null;
}

/**
 * The three layers for a mashup, or null when the pair cannot be built.
 * Order matters: `a` gives the face and eyes, `b` gives the mouth.
 */
export function partsFor(a: string, b: string): MashParts | null {
    if (!canLead(a) || !canFollow(b)) return null;

    const base = baseUrl(a);
    if (!base) return null;

    return {
        base,
        eyes: `${PARTS_BASE_URL}/eyes/${a}.svg`,
        mouth: `${PARTS_BASE_URL}/mouth/${b}.svg`
    };
}

/** Emoji that can lead — the left-hand grid for generated mode. */
export function leaders(): string[] {
    return PART_EMOJI.filter(canLead);
}

/** Emoji that can follow a given leader — the right-hand grid. */
export function followers(): string[] {
    return PART_EMOJI.filter(canFollow);
}
