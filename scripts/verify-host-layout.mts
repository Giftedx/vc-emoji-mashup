/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Copies the complete publication candidate into a temporary worktree of a
 * Vencord checkout, then runs Vencord's build, TypeScript and ESLint gates.
 *
 *   pnpm verify-host-layout -- C:\path\to\Vencord
 *   VENCORD_PATH=/path/to/Vencord pnpm verify-host-layout
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// pnpm forwards the `--` separator itself on Linux but eats it on Windows, so
// the path is not reliably argv[2]. Take the first argument that is not it.
const suppliedVencord = process.argv.slice(2).find(arg => arg !== "--") ?? process.env.VENCORD_PATH;

if (!suppliedVencord) {
    throw new Error("Pass a Vencord checkout path as an argument or set VENCORD_PATH");
}

const vencordRoot = realpathSync(resolve(suppliedVencord));
const vencordModules = join(vencordRoot, "node_modules");
if (!existsSync(join(vencordRoot, "package.json")) || !existsSync(join(vencordRoot, ".git"))) {
    throw new Error(`${vencordRoot} is not a Vencord Git checkout`);
}
if (!existsSync(vencordModules)) {
    throw new Error(`Install Vencord dependencies first: missing ${vencordModules}`);
}

const worktree = join(tmpdir(), `vc-emoji-host-${randomUUID()}`);
const pluginTarget = join(worktree, "src", "userplugins", "emojiMashup");
let registered = false;

function run(command: string, args: readonly string[], cwd = repoRoot): void {
    const result = spawnSync(command, [...args], {
        cwd,
        stdio: "inherit"
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

    run(process.execPath, [
        "--require=./scripts/suppressExperimentalWarnings.js",
        "scripts/build/build.mjs"
    ], worktree);

    run(process.execPath, [
        join(worktree, "node_modules", "typescript", "bin", "tsc"),
        "--noEmit"
    ], worktree);
    run(
        process.execPath,
        [
            join(worktree, "node_modules", "eslint", "bin", "eslint.js"),
            "src/userplugins/emojiMashup/**/*.{ts,tsx,mts}"
        ],
        worktree
    );

    console.log(`host layout verified against Vencord ${vencordRoot}`);
} finally {
    if (registered) {
        run("git", ["-C", vencordRoot, "worktree", "remove", "--force", worktree]);
        run("git", ["-C", vencordRoot, "worktree", "prune"]);
    }
}
