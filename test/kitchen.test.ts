import { describe, expect, it } from "vitest";

import type { RawIndex } from "../src/codec";
import { buildUrl, createKitchen, toUrlSegment } from "../src/kitchen";

const raw: RawIndex = {
    emoji: ["2615", "263a-fe0f", "1f62e-200d-1f4a8"],
    names: [
        "coffee\thot,drink\tfood & drink\tdrink",
        "smile\thappy\tsmileys\tface",
        "face-exhaling\tblow\tsmileys\tface"
    ],
    dates: ["20201001", "20260128"],
    pairs: [
        { lo: 0, hi: 1, dateIndex: 0, loIsUrlLeft: true },
        { lo: 0, hi: 2, dateIndex: 1, loIsUrlLeft: false }
    ]
};

describe("toUrlSegment", () => {
    it("prefixes a single-component codepoint", () => {
        expect(toUrlSegment("2615")).toBe("u2615");
    });

    it("prefixes EVERY component of a variation-selector sequence", () => {
        expect(toUrlSegment("263a-fe0f")).toBe("u263a-ufe0f");
    });

    it("prefixes EVERY component of a ZWJ sequence", () => {
        expect(toUrlSegment("1f62e-200d-1f4a8")).toBe("u1f62e-u200d-u1f4a8");
    });

    it("never emits a bare hyphen-joined codepoint", () => {
        // The naive `u${codepoint}` form matched only 75.9% of real pairs
        // and 404'd on the other 24.1%. Guard against regressing to it.
        expect(toUrlSegment("2708-fe0f")).not.toBe("u2708-fe0f");
    });
});

describe("buildUrl", () => {
    it("matches the gstatic path shape exactly", () => {
        expect(buildUrl("20231113", "1f4f0", "1f349"))
            .toBe("https://www.gstatic.com/android/keyboard/emojikitchen/20231113/u1f4f0/u1f4f0_u1f349.png");
    });

    it("applies the component rule to both sides", () => {
        expect(buildUrl("20230301", "263a-fe0f", "2615"))
            .toBe("https://www.gstatic.com/android/keyboard/emojikitchen/20230301/u263a-ufe0f/u263a-ufe0f_u2615.png");
    });
});

describe("kitchen", () => {
    const k = createKitchen(raw);

    it("honours orientation when lo is the URL left", () => {
        expect(k.urlFor("2615", "263a-fe0f"))
            .toBe("https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u2615/u2615_u263a-ufe0f.png");
    });

    it("honours orientation when hi is the URL left", () => {
        expect(k.urlFor("2615", "1f62e-200d-1f4a8"))
            .toBe("https://www.gstatic.com/android/keyboard/emojikitchen/20260128/u1f62e-u200d-u1f4a8/u1f62e-u200d-u1f4a8_u2615.png");
    });

    it("returns the same URL regardless of argument order", () => {
        expect(k.urlFor("263a-fe0f", "2615")).toBe(k.urlFor("2615", "263a-fe0f"));
        expect(k.urlFor("1f62e-200d-1f4a8", "2615")).toBe(k.urlFor("2615", "1f62e-200d-1f4a8"));
    });

    it("returns null for a pair that does not exist", () => {
        expect(k.urlFor("263a-fe0f", "1f62e-200d-1f4a8")).toBeNull();
    });

    it("returns null for an unknown codepoint", () => {
        expect(k.urlFor("2615", "dead-beef")).toBeNull();
        expect(k.urlFor("dead-beef", "2615")).toBeNull();
    });

    it("lists partners symmetrically", () => {
        expect(k.partnersOf("2615").map(m => m.partner).sort())
            .toEqual(["1f62e-200d-1f4a8", "263a-fe0f"]);
        expect(k.partnersOf("263a-fe0f").map(m => m.partner)).toEqual(["2615"]);
        expect(k.partnersOf("1f62e-200d-1f4a8").map(m => m.partner)).toEqual(["2615"]);
    });

    it("returns no partners for an unknown codepoint", () => {
        expect(k.partnersOf("dead-beef")).toEqual([]);
    });

    it("gives partners the same URL as urlFor", () => {
        for (const m of k.partnersOf("2615")) {
            expect(m.url).toBe(k.urlFor("2615", m.partner));
        }
    });

    it("exposes names and categories", () => {
        expect(k.nameOf("2615")).toBe("coffee");
        expect(k.categoryOf("2615")).toBe("food & drink");
        expect(k.nameOf("dead-beef")).toBe("");
        expect(k.categoryOf("dead-beef")).toBe("");
    });

    it("names partners by their own alt text", () => {
        expect(k.partnersOf("2615").find(m => m.partner === "263a-fe0f")!.name).toBe("smile");
    });

    it("searches names and keywords case-insensitively", () => {
        expect(k.search("COFFEE")).toContain("2615");
        expect(k.search("drink")).toContain("2615");
        expect(k.search("happy")).toContain("263a-fe0f");
        expect(k.search("zzzz")).toEqual([]);
        expect(k.search("   ")).toEqual([]);
    });

    it("does not match a keyword across the comma separator", () => {
        // "hot,drink" must not be searchable as "hot,d"
        expect(k.search("hot,d")).toEqual([]);
    });
});

describe("self-pairs", () => {
    // Emoji Kitchen genuinely contains self-mashups (coffee + coffee), stored
    // with lo === hi. They must appear exactly once, not twice.
    const selfRaw: RawIndex = {
        emoji: ["2615", "263a-fe0f"],
        names: ["coffee\thot\tfood & drink\tdrink", "smile\thappy\tsmileys\tface"],
        dates: ["20201001"],
        pairs: [
            { lo: 0, hi: 0, dateIndex: 0, loIsUrlLeft: true },
            { lo: 0, hi: 1, dateIndex: 0, loIsUrlLeft: true }
        ]
    };
    const sk = createKitchen(selfRaw);

    it("lists a self-pair exactly once", () => {
        expect(sk.partnersOf("2615").filter(m => m.partner === "2615")).toHaveLength(1);
    });

    it("lists the self-pair alongside ordinary partners", () => {
        expect(sk.partnersOf("2615").map(m => m.partner)).toEqual(["2615", "263a-fe0f"]);
    });

    it("builds a self-pair URL with the emoji on both sides", () => {
        expect(sk.urlFor("2615", "2615"))
            .toBe("https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u2615/u2615_u2615.png");
    });

    it("produces no duplicate partner keys", () => {
        const partners = sk.partnersOf("2615").map(m => m.partner);
        expect(new Set(partners).size).toBe(partners.length);
    });
});
