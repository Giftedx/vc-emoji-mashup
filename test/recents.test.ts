/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from "vitest";

import { getRecents, mergeRecent, pickAndRemember, pushRecent } from "../recents";
import { reset, seed } from "./fakes/dataStore";

const PICK = {
    left: "2615",
    right: "1f600",
    url: "https://example.invalid/mashup.png"
};

beforeEach(reset);

describe("recents storage", () => {
    it("preserves and migrates recents stored under the pre-rename key", async () => {
        seed("dismoji-recents", [PICK]);

        expect(await getRecents()).toEqual([PICK]);

        const next = {
            left: "1f642",
            right: "1f643",
            url: "https://example.invalid/next.png"
        };
        await pushRecent(next);

        expect(await getRecents()).toEqual([next, PICK]);
    });
});

describe("pickAndRemember", () => {
    it("performs the pick before persistence and survives a rejected write", async () => {
        const events: string[] = [];

        await pickAndRemember(
            PICK,
            url => events.push(`pick:${url}`),
            async () => {
                events.push("remember");
                throw new Error("disk full");
            },
            () => events.push("reported")
        );

        expect(events).toEqual([
            `pick:${PICK.url}`,
            "remember",
            "reported"
        ]);
    });
});

describe("mergeRecent", () => {
    it("moves a duplicate to the front and caps the list at 24", () => {
        const list = Array.from({ length: 24 }, (_, i) => ({
            left: `${i}`,
            right: `${i + 1}`,
            url: `https://example.invalid/${i}.png`
        }));
        const duplicate = list[12];

        const merged = mergeRecent(list, duplicate);

        expect(merged).toHaveLength(24);
        expect(merged[0]).toEqual(duplicate);
        expect(merged.filter(item => item.url === duplicate.url)).toHaveLength(1);
    });
});
