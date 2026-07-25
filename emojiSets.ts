/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Emoji artwork sets for the picker grid.
 *
 * This affects only the emoji you pick FROM. The mashups themselves are
 * pre-rendered by Google and cannot be restyled — there is no Twitter or
 * Microsoft rendering of "coffee + smile".
 *
 * Both CDNs are on jsDelivr, which Vencord already allows in its CSP
 * (src/main/csp/index.ts), so no extra host permission is needed.
 */

export type EmojiSet = "system" | "twitter" | "google";

const TWEMOJI = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72";
const NOTO = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@8998f5dd683424a73e2314a8c1f1e359c19e8742/png/128";

/**
 * Ordered candidate URLs for a codepoint, best first. Consumers try each in
 * turn and fall back to rendering the character as text when all fail.
 *
 * Empty means "use the system font" — no request at all.
 *
 * Coverage measured against all 619 supported emoji:
 *   twitter  619/619
 *   google   617/619 (missing a9-fe0f and ae-fe0f, which Noto has no asset for)
 */
export function emojiAssetUrls(set: EmojiSet, codepoint: string): string[] {
    if (set === "system") return [];

    const parts = codepoint.split("-");
    const stripped = parts.filter(p => p !== "fe0f");

    if (set === "twitter") {
        // Twemoji strips FE0F, except in ZWJ sequences where it keeps it.
        // Verified deterministic across all 619: no fallback needed.
        const name = parts.includes("200d") ? parts.join("-") : stripped.join("-");
        return [`${TWEMOJI}/${name}.png`];
    }

    // Noto has no single rule — some names keep FE0F, others drop it, so both
    // are offered and the caller falls through on 404.
    const asIs = `${NOTO}/emoji_u${parts.join("_")}.png`;
    if (stripped.length === parts.length) return [asIs];
    return [asIs, `${NOTO}/emoji_u${stripped.join("_")}.png`];
}
