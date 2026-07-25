/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { emojiAssetUrls } from "../emojiSets";

describe("system set", () => {
    it("requests nothing, so the OS font renders", () => {
        expect(emojiAssetUrls("system", "2615")).toEqual([]);
        expect(emojiAssetUrls("system", "1f62e-200d-1f4a8")).toEqual([]);
    });
});

describe("twitter (twemoji)", () => {
    const url = (cp: string) => emojiAssetUrls("twitter", cp);

    it("uses a plain codepoint filename", () => {
        expect(url("1f600")).toEqual([
            "https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72/1f600.png"
        ]);
    });

    it("strips fe0f when there is no ZWJ joiner", () => {
        // Verified live: 263a.png exists, 263a-fe0f.png 404s.
        expect(url("263a-fe0f")[0]).toContain("/263a.png");
    });

    it("keeps fe0f inside a ZWJ sequence", () => {
        // Verified live: 1f642-200d-2195-fe0f.png exists.
        expect(url("1f642-200d-2195-fe0f")[0]).toContain("/1f642-200d-2195-fe0f.png");
    });

    it("keeps a ZWJ sequence that has no fe0f intact", () => {
        expect(url("1f62e-200d-1f4a8")[0]).toContain("/1f62e-200d-1f4a8.png");
    });

    it("offers exactly one candidate — the rule is deterministic", () => {
        for (const cp of ["1f600", "263a-fe0f", "1f642-200d-2195-fe0f", "2708-fe0f"]) {
            expect(url(cp)).toHaveLength(1);
        }
    });
});

describe("google (noto)", () => {
    const url = (cp: string) => emojiAssetUrls("google", cp);

    it("uses underscore-joined emoji_u filenames", () => {
        expect(url("1f600")).toEqual([
            "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u1f600.png"
        ]);
    });

    it("offers both fe0f variants when the codepoint has one", () => {
        const candidates = url("263a-fe0f");
        expect(candidates).toHaveLength(2);
        expect(candidates[0]).toContain("emoji_u263a_fe0f.png");
        expect(candidates[1]).toContain("emoji_u263a.png");
    });

    it("offers a single candidate when there is no fe0f to strip", () => {
        expect(url("1f62e-200d-1f4a8")).toHaveLength(1);
    });
});

describe("all sets", () => {
    it("never produces a URL outside jsDelivr", () => {
        for (const set of ["twitter", "google"] as const) {
            for (const cp of ["1f600", "263a-fe0f", "1f642-200d-2195-fe0f"]) {
                for (const u of emojiAssetUrls(set, cp)) {
                    expect(u.startsWith("https://cdn.jsdelivr.net/")).toBe(true);
                }
            }
        }
    });
});
