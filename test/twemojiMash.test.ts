/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { canFollow, canLead, followers, leaders, mashableEmoji, partsFor } from "../twemojiMash";

describe("parts inventory", () => {
    it("has a usable set of emoji", () => {
        expect(mashableEmoji.length).toBeGreaterThan(100);
    });

    it("has no duplicates", () => {
        expect(new Set(mashableEmoji).size).toBe(mashableEmoji.length);
    });

    it("yields both leaders and followers", () => {
        expect(leaders().length).toBeGreaterThan(50);
        expect(followers().length).toBeGreaterThan(50);
    });

    it("every leader can also resolve a base", () => {
        for (const cp of leaders()) {
            expect(partsFor(cp, followers()[0])).not.toBeNull();
        }
    });
});

describe("partsFor", () => {
    const a = leaders()[0];
    const b = followers()[0];

    it("returns three layers for a valid pair", () => {
        const p = partsFor(a, b)!;
        expect(p).not.toBeNull();
        expect(p.base).toMatch(/\.svg$/);
        expect(p.eyes).toMatch(/\.svg$/);
        expect(p.mouth).toMatch(/\.svg$/);
    });

    it("takes eyes from the first emoji and mouth from the second", () => {
        const p = partsFor(a, b)!;
        expect(p.eyes).toContain(`/eyes/${a}.svg`);
        expect(p.mouth).toContain(`/mouth/${b}.svg`);
    });

    it("is order-sensitive — swapping gives different layers", () => {
        const ab = partsFor(a, b);
        const ba = partsFor(b, a);
        if (ab && ba && a !== b) {
            expect(ab.eyes).not.toBe(ba.eyes);
        }
    });

    it("pins every URL to the parts CDN", () => {
        const p = partsFor(a, b)!;
        for (const url of [p.base, p.eyes, p.mouth]) {
            expect(url.startsWith("https://cdn.jsdelivr.net/gh/Ryhon0/open-emoji-mash@")).toBe(true);
        }
    });

    it("pins to a commit SHA, never a moving branch", () => {
        const p = partsFor(a, b)!;
        expect(p.base).toMatch(/@[0-9a-f]{40}\//);
    });

    it("returns null when the leader cannot lead", () => {
        expect(partsFor("not-an-emoji", b)).toBeNull();
    });

    it("returns null when the follower has no mouth", () => {
        expect(partsFor(a, "not-an-emoji")).toBeNull();
    });

    it("allows an emoji to mash with itself", () => {
        const self = leaders().find(cp => canFollow(cp))!;
        expect(canLead(self) && canFollow(self)).toBe(true);
        expect(partsFor(self, self)).not.toBeNull();
    });
});
