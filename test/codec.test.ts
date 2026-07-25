/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { decodeIndex, encodeIndex, type RawIndex } from "../codec";

const sample: RawIndex = {
    emoji: ["2615", "263a-fe0f", "1f62e-200d-1f4a8"],
    names: [
        "coffee\thot,drink\tfood & drink\tdrink",
        "smile\thappy\tsmileys\tface",
        "face-exhaling\tblow\tsmileys\tface"
    ],
    dates: ["20201001", "20260128"],
    pairs: [
        { lo: 0, hi: 1, dateIndex: 0, loIsUrlLeft: true },
        { lo: 0, hi: 2, dateIndex: 1, loIsUrlLeft: false },
        { lo: 1, hi: 2, dateIndex: 1, loIsUrlLeft: true }
    ]
};

describe("codec", () => {
    it("round-trips an index without loss", () => {
        expect(decodeIndex(encodeIndex(sample))).toEqual(sample);
    });

    it("preserves orientation flags independently of index order", () => {
        const out = decodeIndex(encodeIndex(sample));
        expect(out.pairs[0].loIsUrlLeft).toBe(true);
        expect(out.pairs[1].loIsUrlLeft).toBe(false);
        expect(out.pairs[2].loIsUrlLeft).toBe(true);
    });

    it("preserves multi-component codepoints verbatim", () => {
        const out = decodeIndex(encodeIndex(sample));
        expect(out.emoji).toContain("1f62e-200d-1f4a8");
        expect(out.emoji).toContain("263a-fe0f");
    });

    it("preserves non-ASCII bytes in the name table", () => {
        const withUnicode: RawIndex = {
            ...sample,
            names: ["café\tnaïve,über\tfood & drink\tdrink", ...sample.names.slice(1)]
        };
        expect(decodeIndex(encodeIndex(withUnicode)).names[0]).toBe("café\tnaïve,über\tfood & drink\tdrink");
    });

    it("handles the maximum date index that fits in 7 bits", () => {
        const many: RawIndex = {
            ...sample,
            dates: Array.from({ length: 127 }, (_, i) => String(20000101 + i)),
            pairs: [{ lo: 0, hi: 1, dateIndex: 126, loIsUrlLeft: false }]
        };
        const out = decodeIndex(encodeIndex(many));
        expect(out.pairs[0].dateIndex).toBe(126);
        expect(out.pairs[0].loIsUrlLeft).toBe(false);
    });

    it("rejects bytes with a bad magic number", () => {
        const bad = encodeIndex(sample);
        bad[0] = 0x00;
        expect(() => decodeIndex(bad)).toThrow(/magic/i);
    });

    it("rejects an unsupported version", () => {
        const bad = encodeIndex(sample);
        bad[4] = 99;
        expect(() => decodeIndex(bad)).toThrow(/version/i);
    });

    it("round-trips an empty pair list", () => {
        const empty: RawIndex = { ...sample, pairs: [] };
        expect(decodeIndex(encodeIndex(empty))).toEqual(empty);
    });
});
