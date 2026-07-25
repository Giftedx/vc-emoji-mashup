/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

describe("clone-into-Vencord layout", () => {
    it("keeps Vencord's tsconfig authoritative while making development tests host-safe", () => {
        expect(existsSync(resolve(root, "tsconfig.json"))).toBe(false);

        const shim = readFileSync(resolve(root, "vencord-host-shims.d.ts"), "utf8");
        expect(shim).toContain('declare module "vitest"');
        expect(shim).toContain('declare module "vitest/config"');
    });

    it("exposes the clean-room host verification command", () => {
        const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
        expect(pkg.scripts["verify-host-layout"]).toBe("tsx scripts/verify-host-layout.mts");
    });
});
