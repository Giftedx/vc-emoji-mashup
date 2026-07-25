import { React, useEffect, useMemo, useState } from "@webpack/common";

import { type Kitchen, type Mashup, toEmojiChar } from "./kitchen";
import { loadKitchen } from "./loadKitchen";
import { getRecents, pushRecent, type Recent } from "./recents";

const GSTATIC = "https://www.gstatic.com";

interface Props {
    onPick(url: string): void;
}

/**
 * Two-stage picker. Stage 1 lists the 619 supported emoji; stage 2 lists the
 * chosen emoji's ~475 partners, each cell rendering the real mashup image.
 *
 * Knows nothing about how it is mounted — the same component backs both the
 * expression-picker tab and the chat-bar modal fallback.
 *
 * Cells NEVER hide themselves when an image fails. Previews are blocked by CSP
 * until the user grants gstatic, and a hide-on-error policy empties the whole
 * grid in that state, leaving nothing to click. Failed images fall back to the
 * emoji characters instead, so picking always works.
 */
export function MashupPicker({ onPick }: Props) {
    const [kitchen, setKitchen] = useState<Kitchen | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [left, setLeft] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [recents, setRecents] = useState<Recent[]>([]);
    const [previewsAllowed, setPreviewsAllowed] = useState<boolean | null>(null);
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

    useEffect(() => {
        loadKitchen().then(setKitchen, e => setError(String(e)));
        getRecents().then(setRecents);
        VencordNative.csp.isDomainAllowed(GSTATIC, ["img-src"]).then(setPreviewsAllowed);
    }, []);

    async function requestPreviews() {
        const result = await VencordNative.csp.requestAddOverride(GSTATIC, ["img-src"], "Emoji Mashup");
        if (result === "ok") setPreviewsAllowed(true);
    }

    function markFailed(url: string) {
        setFailed(prev => (prev.has(url) ? prev : new Set(prev).add(url)));
    }

    const grouped = useMemo(() => {
        if (!kitchen) return [];
        const groups = new Map<string, string[]>();
        for (const cp of kitchen.emoji) {
            const category = kitchen.categoryOf(cp) || "other";
            let bucket = groups.get(category);
            if (!bucket) groups.set(category, bucket = []);
            bucket.push(cp);
        }
        return [...groups];
    }, [kitchen]);

    if (error) {
        return <div className="dismoji-state">Could not load the mashup index: {error}</div>;
    }
    if (!kitchen) {
        return <div className="dismoji-state">Loading mashups…</div>;
    }

    const k = kitchen;

    async function choose(leftCp: string, m: Mashup) {
        await pushRecent({ left: leftCp, right: m.partner, url: m.url });
        setRecents(await getRecents());
        onPick(m.url);
    }

    /**
     * A mashup thumbnail that degrades to text rather than vanishing.
     * `fallback` is what the cell shows when the image cannot be displayed.
     */
    function thumbnail(url: string, alt: string, fallback: string) {
        if (previewsAllowed === false || failed.has(url)) {
            return <span className="dismoji-cell-fallback">{fallback}</span>;
        }
        return <img src={url} alt={alt} loading="lazy" onError={() => markFailed(url)} />;
    }

    const notice = previewsAllowed === false && (
        <div className="dismoji-notice">
            <div>
                Previews are blocked, so combinations show as plain emoji below. Picking
                and sending still work — Discord fetches the image server-side, so
                everyone else sees the real mashup.
            </div>
            <button className="dismoji-allow" onClick={requestPreviews}>Allow previews</button>
            <small>Requires restarting Discord after allowing.</small>
        </div>
    );

    // ---- Stage 1: choose the left emoji ----
    if (left === null) {
        const emojiCell = (cp: string) => (
            <button
                key={cp}
                className="dismoji-cell dismoji-cell-text"
                title={k.nameOf(cp)}
                onClick={() => { setLeft(cp); setQuery(""); }}
            >
                {toEmojiChar(cp)}
            </button>
        );

        return (
            <div className="dismoji-root">
                {notice}
                <input
                    className="dismoji-search"
                    placeholder="Search emoji…"
                    value={query}
                    onChange={e => setQuery(e.currentTarget.value)}
                />

                {recents.length > 0 && !query && (
                    <>
                        <div className="dismoji-label">Recent</div>
                        <div className="dismoji-grid dismoji-recents">
                            {recents.map(r => (
                                <button
                                    key={r.url}
                                    className="dismoji-cell"
                                    title={`${k.nameOf(r.left)} + ${k.nameOf(r.right)}`}
                                    onClick={() => onPick(r.url)}
                                >
                                    {thumbnail(r.url, "", toEmojiChar(r.left) + toEmojiChar(r.right))}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {query
                    ? <div className="dismoji-grid">{k.search(query).map(emojiCell)}</div>
                    : grouped.map(([category, codepoints]) => (
                        <React.Fragment key={category}>
                            <div className="dismoji-label">{category}</div>
                            <div className="dismoji-grid">{codepoints.map(emojiCell)}</div>
                        </React.Fragment>
                    ))}
            </div>
        );
    }

    // ---- Stage 2: choose the partner ----
    const all = k.partnersOf(left);
    const partners = query
        ? all.filter(m => m.name.toLowerCase().includes(query.trim().toLowerCase()))
        : all;

    return (
        <div className="dismoji-root">
            {notice}
            <div className="dismoji-header">
                <button className="dismoji-back" onClick={() => { setLeft(null); setQuery(""); }}>
                    ‹ Back
                </button>
                <span className="dismoji-chosen">{toEmojiChar(left)}</span>
                <span className="dismoji-count">{k.nameOf(left)} — {all.length} mashups</span>
            </div>

            <input
                className="dismoji-search"
                placeholder="Filter partners…"
                value={query}
                onChange={e => setQuery(e.currentTarget.value)}
            />

            {partners.length === 0
                ? <div className="dismoji-state">Nothing matches “{query}”.</div>
                : (
                    <div className="dismoji-grid">
                        {partners.map(m => (
                            <button
                                key={m.partner}
                                className="dismoji-cell"
                                title={`${k.nameOf(left!)} + ${m.name}`}
                                onClick={() => choose(left!, m)}
                            >
                                {thumbnail(m.url, m.name, toEmojiChar(left!) + toEmojiChar(m.partner))}
                            </button>
                        ))}
                    </div>
                )}
        </div>
    );
}
