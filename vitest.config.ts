/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@api/DataStore": new URL("./test/fakes/dataStore.ts", import.meta.url).pathname
        }
    },
    test: {
        include: ["test/**/*.test.ts"]
    }
});
