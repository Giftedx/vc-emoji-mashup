/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Binary format for the bundled Emoji Kitchen pair index.
 *
 * Encode and decode live in this one file deliberately: a wire format defined in
 * two places drifts. The build script and the runtime both go through here.
 *
 * Layout (little-endian):
 *   magic       u32   "DSMJ"
 *   version     u8
 *   emojiCount  u16
 *   dateCount   u8
 *   pairCount   u32
 *   emoji[]     emojiCount x (u8 len + utf8 bytes)
 *   names[]     emojiCount x (u16 len + utf8 bytes)
 *   dates[]     dateCount x 8 ascii bytes ("YYYYMMDD")
 *   pairs[]     pairCount x (u16 lo, u16 hi, u8 flags)
 *
 * flags: bits 0-6 = date index, bit 7 = orientation.
 *   bit 7 clear -> the gstatic URL is lo_hi
 *   bit 7 set   -> the gstatic URL is hi_lo
 *
 * Orientation must be stored, not inferred. Across the real dataset the URL's
 * left emoji is the lower-indexed one in only 62,501 of 147,000 pairs, so
 * deriving it from index order would break 57% of lookups.
 */

export interface PairRecord {
    /** Lower emoji-table index of the pair. */
    lo: number;
    /** Higher emoji-table index of the pair. */
    hi: number;
    /** Index into the date table. Must fit in 7 bits. */
    dateIndex: number;
    /** True when the gstatic URL orders this pair lo_hi rather than hi_lo. */
    loIsUrlLeft: boolean;
}

export interface RawIndex {
    /** Codepoint strings, e.g. "2615", "263a-fe0f", "1f62e-200d-1f4a8". */
    emoji: string[];
    /** Parallel to `emoji`: "alt\tkw1,kw2\tcategory\tsubcategory". */
    names: string[];
    /** "YYYYMMDD" strings. */
    dates: string[];
    pairs: PairRecord[];
}

const MAGIC = 0x4a4d5344; // "DSMJ" read little-endian
const VERSION = 1;
const MAX_DATES = 128; // dateIndex occupies 7 bits

export function encodeIndex(raw: RawIndex): Uint8Array {
    if (raw.emoji.length !== raw.names.length) {
        throw new Error(`dismoji: emoji (${raw.emoji.length}) and names (${raw.names.length}) must be parallel`);
    }
    if (raw.dates.length > MAX_DATES) {
        throw new Error(`dismoji: ${raw.dates.length} dates exceeds the ${MAX_DATES}-entry limit of the 7-bit date index`);
    }
    if (raw.dates.some(d => d.length !== 8)) {
        throw new Error("dismoji: every date must be exactly 8 characters (YYYYMMDD)");
    }

    const enc = new TextEncoder();
    const emojiBytes = raw.emoji.map(e => enc.encode(e));
    const nameBytes = raw.names.map(n => enc.encode(n));

    for (const b of emojiBytes) {
        if (b.length > 0xff) throw new Error("dismoji: codepoint string exceeds 255 bytes");
    }
    for (const b of nameBytes) {
        if (b.length > 0xffff) throw new Error("dismoji: name entry exceeds 65535 bytes");
    }

    let size = 4 + 1 + 2 + 1 + 4;
    for (const b of emojiBytes) size += 1 + b.length;
    for (const b of nameBytes) size += 2 + b.length;
    size += raw.dates.length * 8;
    size += raw.pairs.length * 5;

    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    let o = 0;

    view.setUint32(o, MAGIC, true); o += 4;
    view.setUint8(o, VERSION); o += 1;
    view.setUint16(o, raw.emoji.length, true); o += 2;
    view.setUint8(o, raw.dates.length); o += 1;
    view.setUint32(o, raw.pairs.length, true); o += 4;

    for (const b of emojiBytes) {
        view.setUint8(o, b.length); o += 1;
        bytes.set(b, o); o += b.length;
    }
    for (const b of nameBytes) {
        view.setUint16(o, b.length, true); o += 2;
        bytes.set(b, o); o += b.length;
    }
    for (const d of raw.dates) {
        bytes.set(enc.encode(d), o); o += 8;
    }
    for (const p of raw.pairs) {
        if (p.dateIndex < 0 || p.dateIndex >= MAX_DATES) {
            throw new Error(`dismoji: date index ${p.dateIndex} does not fit in 7 bits`);
        }
        view.setUint16(o, p.lo, true); o += 2;
        view.setUint16(o, p.hi, true); o += 2;
        view.setUint8(o, (p.dateIndex & 0x7f) | (p.loIsUrlLeft ? 0 : 0x80)); o += 1;
    }

    return bytes;
}

export function decodeIndex(bytes: Uint8Array): RawIndex {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dec = new TextDecoder();
    let o = 0;

    if (view.getUint32(o, true) !== MAGIC) {
        throw new Error("dismoji: bad magic number — not a dismoji index");
    }
    o += 4;

    const version = view.getUint8(o); o += 1;
    if (version !== VERSION) {
        throw new Error(`dismoji: unsupported index version ${version}, expected ${VERSION}`);
    }

    const emojiCount = view.getUint16(o, true); o += 2;
    const dateCount = view.getUint8(o); o += 1;
    const pairCount = view.getUint32(o, true); o += 4;

    const emoji: string[] = new Array(emojiCount);
    for (let i = 0; i < emojiCount; i++) {
        const len = view.getUint8(o); o += 1;
        emoji[i] = dec.decode(bytes.subarray(o, o + len)); o += len;
    }

    const names: string[] = new Array(emojiCount);
    for (let i = 0; i < emojiCount; i++) {
        const len = view.getUint16(o, true); o += 2;
        names[i] = dec.decode(bytes.subarray(o, o + len)); o += len;
    }

    const dates: string[] = new Array(dateCount);
    for (let i = 0; i < dateCount; i++) {
        dates[i] = dec.decode(bytes.subarray(o, o + 8)); o += 8;
    }

    const pairs: PairRecord[] = new Array(pairCount);
    for (let i = 0; i < pairCount; i++) {
        const lo = view.getUint16(o, true); o += 2;
        const hi = view.getUint16(o, true); o += 2;
        const flags = view.getUint8(o); o += 1;
        pairs[i] = { lo, hi, dateIndex: flags & 0x7f, loIsUrlLeft: (flags & 0x80) === 0 };
    }

    return { emoji, names, dates, pairs };
}
