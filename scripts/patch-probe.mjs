/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Runs inside a Vencord reporter worktree, never from this repository directly:
 * `puppeteer-core` is Vencord's dependency, and Node resolves it by walking up
 * from this file to the host's node_modules. scripts/verify-patches.mts is the
 * entry point that arranges that.
 *
 * Loads Discord's real bundle with Vencord attached, logged out, and asserts
 * the three picker-tab replacements landed. Vencord's own reporter proves a
 * patch did NOT fail; that is not the same claim, because a plugin that never
 * compiled in also never fails. This asserts the patched module exists.
 */

import { readFileSync } from "node:fs";

import pup from "puppeteer-core";

const CHROMIUM_BIN = process.env.CHROMIUM_BIN;
const PLUGIN = "EmojiMashup";
const OVERALL_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * One marker per replacement in index.tsx, chosen so that a partial patch
 * cannot pass: each string only exists in the module if that replacement ran.
 *   1. the tab element        -> the id given to the injected tab
 *   2. the tablist insertion  -> the variable the tab is held in
 *   3. the panel render       -> the plugin member the injected branch calls
 */
const MARKERS = ["vc-mashup-tab", "vcMashupTab", "PickerPanel"];

if (!CHROMIUM_BIN) {
    console.error("patch-probe: CHROMIUM_BIN is not set");
    process.exit(1);
}

const failures = [];
let buildNumber = "unknown";

const browser = await pup.launch({
    headless: true,
    executablePath: CHROMIUM_BIN,
    args: ["--no-sandbox"]
});

const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36");
await page.setBypassCSP(true);

/** Resolves when Vencord's reporter reports it has finished loading every chunk. */
let finished;
const finishedTest = new Promise(resolve => { finished = resolve; });

page.on("console", async event => {
    let args;
    try {
        args = await Promise.all(event.args().map(handle => handle.jsonValue()));
    } catch {
        return;
    }

    const [first, tag, message] = args;

    if (first === "[REPORTER_META]") {
        buildNumber = tag?.buildNumber ?? buildNumber;
        return;
    }
    if (first !== "[Vencord]") return;

    // Only this plugin's failures are ours to fail on. Vencord ships plugins
    // that break against live Discord all the time, and that is their problem.
    if (tag === "WebpackPatcher:") {
        const match = message?.match(/Patch by (.+?) (had no effect|errored|found no module) \(Module id is (.+?)\): (.+)/);
        if (match && match[1] === PLUGIN) failures.push(`patch ${match[2]}: ${match[4]}`);
    }
    if (tag === "PluginManager:") {
        const match = message?.match(/Failed to start (.+)/);
        if (match && match[1] === PLUGIN) failures.push("plugin failed to start");
    }
    if (tag === "Reporter:" && message === "Finished test") finished();
    if (message === "A fatal error occurred:") {
        failures.push(`fatal error from ${tag}`);
        finished();
    }
});

await page.evaluateOnNewDocument(`
    if (location.host.endsWith("discord.com")) {
        ${readFileSync("./dist/browser.js", "utf-8")};
    }
`);

await page.goto("https://discord.com/login");

const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timed out waiting for the reporter to finish")), OVERALL_TIMEOUT_MS));

try {
    await Promise.race([finishedTest, timeout]);
} catch (error) {
    failures.push(error.message);
}

// The positive half: the patched module has to actually be there.
//
// search() cannot answer this. A patched factory deliberately reports the
// ORIGINAL source from toString (patchWebpack.ts redirects it) so that Discord
// code stringifying its own modules is unaffected. The injected code lives on
// the factory's patchedSource symbol instead, which is what this reads — found
// by description, because the symbols are not exported onto Vencord.Webpack.
const found = await page.evaluate(input => {
    const vencord = globalThis.Vencord;
    if (!vencord) return { error: "Vencord did not load" };

    const plugin = vencord.Plugins?.plugins?.[input.plugin];
    if (!plugin) return { error: `${input.plugin} was not compiled into the build` };

    // The plugin's own patch target, so this finds the module Discord shipped
    // rather than anything the patch itself introduced.
    const targets = vencord.Webpack.search(input.find);
    const ids = Object.keys(targets);
    if (ids.length !== 1) {
        return { error: `expected exactly one module matching the patch's find, got ${ids.length}` };
    }

    const factory = targets[ids[0]];
    const symbols = Object.getOwnPropertySymbols(factory);
    const symbolOf = suffix => symbols.find(symbol => symbol.description?.endsWith(suffix));

    const sourceSymbol = symbolOf("patchedSource");
    const bySymbol = symbolOf("patchedBy");
    if (!sourceSymbol) {
        return { error: "no patchedSource symbol on the factory — nothing patched this module", symbols: symbols.map(s => s.description) };
    }

    const patchedBy = bySymbol ? [...(factory[bySymbol] ?? [])] : [];
    const patchedSource = factory[sourceSymbol] ?? "";

    return {
        moduleId: ids[0],
        patchedBy,
        missing: input.list.filter(marker => !patchedSource.includes(marker))
    };
}, { plugin: PLUGIN, list: MARKERS, find: 'analyticsSource:"expression-picker"' });

await browser.close();

if (found.error) {
    failures.push(found.error + (found.symbols ? ` (symbols present: ${found.symbols.join(", ")})` : ""));
} else {
    if (!found.patchedBy.includes(PLUGIN)) {
        failures.push(`module ${found.moduleId} was not patched by ${PLUGIN} (patched by: ${found.patchedBy.join(", ") || "nothing"})`);
    }
    if (found.missing.length > 0) {
        failures.push(`replacements missing from the patched source: ${found.missing.join(", ")}`);
    }
}

console.log(`Discord stable build ${buildNumber}`);
if (!found.error) {
    console.log(`expression-picker module ${found.moduleId}, patched by: ${found.patchedBy.join(", ")}`);
}

if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${PLUGIN}: ${failure}`);
    process.exit(1);
}

console.log(`${PLUGIN}: all ${MARKERS.length} replacements applied to Discord's live bundle`);
