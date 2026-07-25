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
 */
export function MashupPicker({ onPick }: Props) {
    const [kitchen, setKitchen] = useState<Kitchen | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [left, setLeft] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [recents, setRecents] = useState<Recent[]>([]);
    const [previewsAllowed, setPreviewsAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        loadKitchen().then(setKitchen, e => setError(String(e)));
        getRecents().then(setRecents);
        VencordNative.csp.isDomainAllowed(GSTATIC, ["img-src"]).then(setPreviewsAllowed);
    }, []);

    async function requestPreviews() {
        const result = await VencordNative.csp.requestAddOverride(GSTATIC, ["img-src"], "Emoji Mashup");
        if (result === "ok") setPreviewsAllowed(true);
    }

    async function choose(leftCp: string, m: Mashup) {
        await pushRecent({ left: leftCp, right: m.partner, url: m.url });
        setRecents(await getRecents());
        onPick(m.url);
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

    const notice = previewsAllowed === false && (
        <div className="dismoji-notice">
            <div>
                Previews are blocked. Mashups still send correctly — Discord fetches
                the image server-side, so everyone else sees it.
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
                title={kitchen.nameOf(cp)}
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
                                <button key={r.url} className="dismoji-cell" onClick={() => onPick(r.url)}>
                                    <img
                                        src={r.url}
                                        alt=""
                                        loading="lazy"
                                        onError={e => hideCell(e.currentTarget)}
                                    />
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {query
                    ? <div className="dismoji-grid">{kitchen.search(query).map(emojiCell)}</div>
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
    const all = kitchen.partnersOf(left);
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
                <span className="dismoji-count">{kitchen.nameOf(left)} — {all.length} mashups</span>
            </div>

            <input
                className="dismoji-search"
                placeholder="Filter partners…"
                value={query}
                onChange={e => setQuery(e.currentTarget.value)}
            />

            <div className="dismoji-grid">
                {partners.map(m => (
                    <button
                        key={m.partner}
                        className="dismoji-cell"
                        title={`${kitchen.nameOf(left)} + ${m.name}`}
                        onClick={() => choose(left, m)}
                    >
                        <img src={m.url} alt={m.name} loading="lazy" onError={e => hideCell(e.currentTarget)} />
                    </button>
                ))}
            </div>
        </div>
    );
}

/** A pair can be in the index but missing from gstatic; drop that cell silently. */
function hideCell(img: HTMLImageElement) {
    const cell = img.closest("button");
    if (cell instanceof HTMLElement) cell.style.display = "none";
}
