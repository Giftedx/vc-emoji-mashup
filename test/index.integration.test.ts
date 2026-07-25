/**
 * Exercises the real generated index rather than a fixture.
 *
 * These assertions are what stop a bad regeneration from shipping: if upstream
 * changes shape, or the packing loses orientation, this fails rather than the
 * user seeing broken images.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Kitchen } from "../src/kitchen";
import { loadKitchen } from "../src/loadKitchen";

let k: Kitchen;

beforeAll(async () => {
    k = await loadKitchen();
});

describe("generated index", () => {
    it("decodes to the expected dataset shape", () => {
        expect(k.emoji.length).toBe(619);
    });

    it("has no duplicate emoji", () => {
        expect(new Set(k.emoji).size).toBe(k.emoji.length);
    });

    it("gives every supported emoji at least one partner", () => {
        const orphans = k.emoji.filter(cp => k.partnersOf(cp).length === 0);
        expect(orphans).toEqual([]);
    });

    it("totals 147,000 unordered pairs", () => {
        // Counted as canonical keys rather than halving the degree sum, because
        // self-pairs contribute one edge-end, not two.
        const seen = new Set<string>();
        for (const cp of k.emoji) {
            for (const m of k.partnersOf(cp)) {
                seen.add(cp < m.partner ? `${cp}|${m.partner}` : `${m.partner}|${cp}`);
            }
        }
        expect(seen.size).toBe(147_000);
    });

    it("never lists a partner twice for the same emoji", () => {
        for (const cp of k.emoji) {
            const partners = k.partnersOf(cp).map(m => m.partner);
            expect(new Set(partners).size).toBe(partners.length);
        }
    });

    it("includes self-pairs", () => {
        const selfPairs = k.emoji.filter(cp => k.partnersOf(cp).some(m => m.partner === cp));
        expect(selfPairs.length).toBeGreaterThan(0);
    });

    it("averages roughly 475 partners per emoji", () => {
        const avg = k.emoji.reduce((n, cp) => n + k.partnersOf(cp).length, 0) / k.emoji.length;
        expect(avg).toBeGreaterThan(400);
        expect(avg).toBeLessThan(550);
    });

    it("is symmetric — every partner lists the original back", () => {
        // Sampled rather than exhaustive: 619 x 475 would be 294k reverse lookups.
        for (const cp of k.emoji.slice(0, 25)) {
            for (const m of k.partnersOf(cp).slice(0, 20)) {
                expect(k.partnersOf(m.partner).some(x => x.partner === cp)).toBe(true);
            }
        }
    });

    it("agrees between partnersOf and urlFor", () => {
        for (const cp of k.emoji.slice(0, 25)) {
            for (const m of k.partnersOf(cp).slice(0, 20)) {
                expect(m.url).toBe(k.urlFor(cp, m.partner));
            }
        }
    });

    it("builds every URL against the real gstatic host and path shape", () => {
        const re = /^https:\/\/www\.gstatic\.com\/android\/keyboard\/emojikitchen\/\d{8}\/u[0-9a-f-u]+\/u[0-9a-f-u]+_u[0-9a-f-u]+\.png$/;
        for (const cp of k.emoji.slice(0, 40)) {
            for (const m of k.partnersOf(cp).slice(0, 10)) {
                expect(m.url).toMatch(re);
            }
        }
    });

    it("never emits an un-prefixed component in a multi-part codepoint", () => {
        const multi = k.emoji.filter(cp => cp.includes("-"));
        expect(multi.length).toBeGreaterThan(0);

        for (const cp of multi.slice(0, 30)) {
            const m = k.partnersOf(cp)[0];
            const segment = cp.split("-").map(c => "u" + c).join("-");
            expect(m.url).toContain(segment);
            // The naive form must never appear.
            expect(m.url).not.toContain(`/u${cp}/`);
        }
    });

    it("preserves both URL orientations across the dataset", () => {
        // 62,501 lo-left vs 84,499 hi-left upstream, so both must be present.
        let loLeft = 0;
        let hiLeft = 0;

        for (const cp of k.emoji.slice(0, 60)) {
            for (const m of k.partnersOf(cp).slice(0, 40)) {
                const seg = (c: string) => c.split("-").map(x => "u" + x).join("-");
                if (m.url.includes(`/${seg(cp)}/${seg(cp)}_`)) loLeft++;
                else hiLeft++;
            }
        }

        expect(loLeft).toBeGreaterThan(0);
        expect(hiLeft).toBeGreaterThan(0);
    });

    it("names every emoji", () => {
        expect(k.emoji.filter(cp => !k.nameOf(cp))).toEqual([]);
    });

    it("categorises every emoji except the two upstream omits", () => {
        // (c) and (R) carry no category in the upstream metadata. The picker
        // buckets these under "other"; pinned here so a change upstream is noticed.
        expect(k.emoji.filter(cp => !k.categoryOf(cp))).toEqual(["a9-fe0f", "ae-fe0f"]);
    });

    it("searches the real keyword table", () => {
        expect(k.search("coffee")).toContain("2615");
        expect(k.search("cat").length).toBeGreaterThan(0);
        expect(k.search("qqqzzz")).toEqual([]);
    });

    it("returns null for a pair that genuinely has no mashup", () => {
        // Search the whole set for a real non-pair rather than assuming one exists;
        // some emoji pair with everything, self included.
        let found = false;
        for (const a of k.emoji) {
            const partners = new Set(k.partnersOf(a).map(m => m.partner));
            const missing = k.emoji.find(cp => !partners.has(cp));
            if (missing) {
                expect(k.urlFor(a, missing)).toBeNull();
                found = true;
                break;
            }
        }
        expect(found).toBe(true);
    });
});
