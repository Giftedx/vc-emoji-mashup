/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Proves the picker-tab patch still applies to Discord's live bundle.
 *
 *   pnpm verify-patches -- C:\path\to\Vencord
 *   VENCORD_PATH=/path/to/Vencord pnpm verify-patches
 *
 * Builds Vencord's reporter bundle with this plugin inside a throwaway
 * worktree, then loads discord.com logged out under headless Chromium and
 * checks the three replacements landed. Nothing signs in and nothing is sent:
 * the patch applies while Discord's webpack modules load, which happens on the
 * login page, so no account is involved.
 *
 * Set CHROMIUM_BIN to choose the browser.
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suppliedVencord = process.argv[2] ?? process.env.VENCORD_PATH;

if (!suppliedVencord) {
    throw new Error("Pass a Vencord checkout path as an argument or set VENCORD_PATH");
}

const CHROMIUM_CANDIDATES = [
    process.env.CHROMIUM_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
].filter((path): path is string => Boolean(path));

const chromium = CHROMIUM_CANDIDATES.find(path => existsSync(path));
if (!chromium) {
    throw new Error(`No Chromium found. Set CHROMIUM_BIN. Tried: ${CHROMIUM_CANDIDATES.join(", ")}`);
}

const vencordRoot = realpathSync(resolve(suppliedVencord));
const vencordModules = join(vencordRoot, "node_modules");
if (!existsSync(join(vencordRoot, "package.json")) || !existsSync(join(vencordRoot, ".git"))) {
    throw new Error(`${vencordRoot} is not a Vencord Git checkout`);
}
if (!existsSync(vencordModules)) {
    throw new Error(`Install Vencord dependencies first: missing ${vencordModules}`);
}

const worktree = join(tmpdir(), `vc-emoji-patches-${randomUUID()}`);
const pluginTarget = join(worktree, "src", "userplugins", "emojiMashup");
let registered = false;

function run(command: string, args: readonly string[], cwd = repoRoot, env: NodeJS.ProcessEnv = {}): void {
    const result = spawnSync(command, [...args], {
        cwd,
        stdio: "inherit",
        env: { ...process.env, ...env }
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${basename(command)} ${args.join(" ")} exited ${result.status}`);
    }
}

function includeInCandidate(source: string): boolean {
    const pathFromRoot = relative(repoRoot, source);
    if (!pathFromRoot) return true;

    const first = pathFromRoot.split(sep)[0];
    return ![".git", "node_modules", ".pnpm-store"].includes(first)
        && pathFromRoot !== "metadata.json";
}

try {
    run("git", ["-C", vencordRoot, "worktree", "add", "--detach", worktree, "HEAD"]);
    registered = true;

    mkdirSync(pluginTarget, { recursive: true });
    cpSync(repoRoot, pluginTarget, {
        recursive: true,
        filter: includeInCandidate
    });
    symlinkSync(
        vencordModules,
        join(worktree, "node_modules"),
        process.platform === "win32" ? "junction" : "dir"
    );

    // Reporter mode enables every plugin and force-loads Discord's lazy chunks,
    // which is what makes the expression-picker module load without signing in.
    //
    // --dev is what makes the result checkable rather than merely unreported:
    // Vencord only records a factory's patched source when IS_DEV, and that
    // recording is the evidence the replacements actually landed.
    run(process.execPath, [
        "--require=./scripts/suppressExperimentalWarnings.js",
        "scripts/build/buildWeb.mjs",
        "--standalone",
        "--reporter",
        "--dev",
        "--skip-extension"
    ], worktree);

    // Fail loudly here rather than leaving the browser to report an absence:
    // "the plugin never compiled in" and "the patch stopped matching" are
    // different problems and only this check separates them.
    const bundle = readFileSync(join(worktree, "dist", "browser.js"), "utf8");
    if (!bundle.includes("vc-mashup-tab")) {
        throw new Error("the reporter bundle does not contain the plugin — it was not compiled in");
    }

    run(process.execPath, [
        join(pluginTarget, "scripts", "patch-probe.mjs")
    ], worktree, { CHROMIUM_BIN: chromium });

    console.log(`patch verified against live Discord using ${vencordRoot}`);
} finally {
    if (registered) {
        run("git", ["-C", vencordRoot, "worktree", "remove", "--force", worktree]);
        run("git", ["-C", vencordRoot, "worktree", "prune"]);
    }
}
