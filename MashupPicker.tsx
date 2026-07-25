import { React, ScrollerThin, Select, TextInput, useEffect, useMemo, useState } from "@webpack/common";

import { type EmojiSet, emojiAssetUrls } from "./emojiSets";
import { type Kitchen, type Mashup, toEmojiChar } from "./kitchen";
import { loadKitchen } from "./loadKitchen";
import { getRecents, pushRecent, type Recent } from "./recents";
import { settings } from "./settings";

/**
 * A single emoji rendered in the chosen set, walking its candidate URLs and
 * finally falling back to the character itself. Never renders nothing.
 */
function SetEmoji({ codepoint, set }: { codepoint: string; set: EmojiSet; }) {
    const [attempt, setAttempt] = useState(0);
    const urls = emojiAssetUrls(set, codepoint);
    const char = toEmojiChar(codepoint);

    if (attempt >= urls.length) return <>{char}</>;

    return (
        <img
            className="dismoji-set-img"
            src={urls[attempt]}
            alt={char}
            loading="lazy"
            onError={() => setAttempt(a => a + 1)}
        />
    );
}

const GSTATIC = "https://www.gstatic.com";

/** Sentinel for the "every category" option in the category dropdown. */
const ALL = "\0all";

/**
 * Matches the leading icon in Discord's own search bars — passing it as
 * TextInput's `prefixElement` is what produces their `hasLeading` layout.
 */
const SearchIcon = () => (
    <svg className="dismoji-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 15.5 L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

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
    const [category, setCategory] = useState(ALL);

    // Must sit with the other hooks, above every early return.
    const emojiSet = settings.use(["emojiSet"]).emojiSet as EmojiSet;

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
     * A mashup thumbnail that degrades to the two source emoji rather than
     * vanishing. The fallback honours the selected emoji set, so a blocked
     * preview still looks like the rest of the picker.
     */
    function thumbnail(url: string, alt: string, a: string, b: string) {
        if (previewsAllowed === false || failed.has(url)) {
            return (
                <span className="dismoji-cell-fallback">
                    <SetEmoji codepoint={a} set={emojiSet} />
                    <SetEmoji codepoint={b} set={emojiSet} />
                </span>
            );
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
                <SetEmoji codepoint={cp} set={emojiSet} />
            </button>
        );

        // The dropdown is a persistent scope; search narrows within it.
        const base = query ? k.search(query) : k.emoji;
        const visible = category === ALL
            ? base
            : base.filter(cp => (k.categoryOf(cp) || "other") === category);

        return (
            <div className="dismoji-root">
                {notice}
                <div className="dismoji-controls">
                    <div className="dismoji-search">
                        <TextInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search emoji…"
                            prefixElement={<SearchIcon />}
                        />
                    </div>
                    <div className="dismoji-category">
                        <Select
                            options={[
                                { label: "All categories", value: ALL },
                                ...grouped.map(([name, cps]) => ({
                                    label: `${name} (${cps.length})`,
                                    value: name
                                }))
                            ]}
                            placeholder="All categories"
                            maxVisibleItems={10}
                            closeOnSelect={true}
                            select={v => setCategory(v)}
                            isSelected={v => v === category}
                            serialize={String}
                        />
                    </div>
                </div>

                {recents.length > 0 && !query && category === ALL && (
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
                                    {thumbnail(r.url, "", r.left, r.right)}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <ScrollerThin className="dismoji-scroller" fade>
                    {visible.length === 0
                        ? <div className="dismoji-state">No emoji match “{query}”.</div>
                        : query || category !== ALL
                            // Flat grid: the category labels would be redundant once
                            // the list is already scoped by the dropdown or a search.
                            ? <div className="dismoji-grid">{visible.map(emojiCell)}</div>
                            : grouped.map(([name, codepoints]) => (
                                <React.Fragment key={name}>
                                    <div className="dismoji-label">{name}</div>
                                    <div className="dismoji-grid">{codepoints.map(emojiCell)}</div>
                                </React.Fragment>
                            ))}
                </ScrollerThin>
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
                <span className="dismoji-chosen"><SetEmoji codepoint={left} set={emojiSet} /></span>
                <span className="dismoji-count">{k.nameOf(left)} — {all.length} mashups</span>
            </div>

            <div className="dismoji-controls">
                <div className="dismoji-search">
                    <TextInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Filter partners…"
                        prefixElement={<SearchIcon />}
                    />
                </div>
            </div>

            <ScrollerThin className="dismoji-scroller" fade>
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
                                    {thumbnail(m.url, m.name, left!, m.partner)}
                                </button>
                            ))}
                        </div>
                    )}
            </ScrollerThin>
        </div>
    );
}
