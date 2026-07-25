/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MashParts } from "./twemojiMash";

const SIZE = 128;

/**
 * Flattens the three SVG layers into a PNG File, ready to upload.
 *
 * Previews in the picker just stack three <img> elements — the browser composites
 * them for free and lazy-loads as you scroll. Canvas is only needed here, at send
 * time, because Discord needs actual bytes.
 */
export async function renderMashup(parts: MashParts, name: string): Promise<File> {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("EmojiMashup: could not get a 2d canvas context");

    // Sequential rather than parallel: draw order is the layer order, and these
    // come from the CDN cache after the preview has already loaded them.
    for (const url of [parts.base, parts.eyes, parts.mouth]) {
        ctx.drawImage(await loadImage(url), 0, 0, SIZE, SIZE);
    }

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("EmojiMashup: canvas produced no image data");

    return new File([blob], `${name}.png`, { type: "image/png" });
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Required for canvas: without it the CDN-loaded SVG taints the canvas
        // and toBlob throws a security error.
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`EmojiMashup: failed to load layer ${url}`));
        img.src = url;
    });
}
