/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const values = new Map<string, unknown>();

export async function get<T>(key: string): Promise<T | undefined> {
    return values.get(key) as T | undefined;
}

export async function set<T>(key: string, value: T): Promise<void> {
    values.set(key, value);
}

export function seed(key: string, value: unknown): void {
    values.set(key, value);
}

export function reset(): void {
    values.clear();
}
