/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Giftedx
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, type ChatBarButtonFactory } from "@api/ChatButtons";
import { copyWithToast, insertTextIntoChatInputBox } from "@utils/discord";
import definePlugin from "@utils/types";
import {
    ChannelStore,
    DraftType,
    ExpressionPickerStore,
    Modal,
    openModal,
    SelectedChannelStore,
    Toasts,
    UploadHandler
} from "@webpack/common";

import { renderMashup } from "./mashRenderer";
import { MashupPicker } from "./MashupPicker";
import { settings } from "./settings";
import type { MashParts } from "./twemojiMash";

/** Emoji Kitchen mashups are hosted images, so sending is just a URL. */
function handlePick(url: string) {
    if (settings.store.sendMode === "copy") {
        copyWithToast(url, "Mashup URL copied!");
    } else {
        insertTextIntoChatInputBox(url + " ");
    }

    if (settings.store.autoClose) ExpressionPickerStore.closeExpressionPicker();
}

/**
 * Generated mashups exist only in the client, so they have no URL to insert —
 * they have to be flattened and uploaded as an attachment instead.
 */
async function handleGeneratedPick(parts: MashParts, name: string) {
    const channelId = SelectedChannelStore.getChannelId();
    const channel = channelId && ChannelStore.getChannel(channelId);

    if (!channel) {
        Toasts.show({
            message: "No channel to send to",
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
        return;
    }

    try {
        const file = await renderMashup(parts, name);
        if (settings.store.autoClose) ExpressionPickerStore.closeExpressionPicker();

        // Deferred so the picker has finished closing before Discord's upload
        // tray appears — the same reason petpet defers its own upload.
        setTimeout(() => UploadHandler.promptToUpload([file], channel, DraftType.ChannelMessage), 10);
    } catch (err) {
        console.error("[EmojiMashup] render failed", err);
        Toasts.show({
            message: "Could not build that mashup",
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
    }
}

const MashupIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <circle cx="15.5" cy="9.5" r="1.5" />
        <path d="M7.5 13.5a4.5 4.5 0 0 0 9 0h-9Z" />
    </svg>
);

/** Fallback surface, used when the picker-tab patch is absent or fails to apply. */
function openMashupModal() {
    openModal(props => (
        <Modal {...props} size="md" title="Emoji Mashup">
            <MashupPicker
                onPick={url => {
                    handlePick(url);
                    if (settings.store.autoClose) props.onClose();
                }}
                onPickGenerated={(parts, name) => {
                    void handleGeneratedPick(parts, name);
                    if (settings.store.autoClose) props.onClose();
                }}
            />
        </Modal>
    ));
}

const MashupChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton tooltip="Emoji Mashup" onClick={openMashupModal}>
            <MashupIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "EmojiMashup",
    description: "Adds a Mashup tab to the emoji picker: Google's Emoji Kitchen combinations, plus generated Twemoji face mashups",
    tags: ["Emotes", "Chat"],
    authors: [{ name: "Giftedx", id: 258276274726895617n }],
    settings,

    /** The custom ExpressionPicker view key. Referenced by the patches below. */
    VIEW: "mashup",

    /** Rendered inside the expression picker when our tab is active. */
    PickerPanel: () => <MashupPicker onPick={handlePick} onPickGenerated={handleGeneratedPick} />,

    // Adds a "Mashup" tab to Discord's expression picker.
    //
    // Everything the injected code needs — the tab component, the view enum, the
    // active-view variable, the jsx factory — is module-local and minified, so it
    // is captured through the regexes rather than referenced by name. All three
    // replacements were verified to match exactly once against the real module
    // source, on Discord build 582977.
    //
    // To re-derive these after a Discord update, run this in the client console:
    //   Object.keys(Vencord.Webpack.search("activeView", "soundboard"))
    // That returned exactly one module, whose source is the patch target.
    //
    // If Discord reships and a match stops applying, Vencord logs
    // "Patch by EmojiMashup had no effect" and undoes the group, leaving the
    // picker untouched. The chat-bar button below keeps working regardless.
    patches: [{
        find: 'analyticsSource:"expression-picker"',
        replacement: [
            {
                // Define our tab next to the EMOJI tab, inside the same `let` list.
                // Captures: $2 = jsx factory, $3 = tab component, $4 = active view.
                match: /(\i)=\(0,(\i)\.jsx\)\((\i),\{id:\i\.\i,"aria-controls":\i\.\i,"aria-selected":(\i)===(\i\.\i)\.EMOJI/,
                replace: 'vcMashupTab=(0,$2.jsx)($3,{id:"vc-mashup-tab","aria-controls":"vc-mashup-panel","aria-selected":$4===$self.VIEW,isActive:$4===$self.VIEW,viewType:$self.VIEW,children:"Mashup"}),$&'
            },
            {
                // Append it to the end of the tablist, after Discord's own tabs.
                match: /(\]\}\)\}\):null,)(\i===\i\.\i\.STICKER)/,
                replace: ",vcMashupTab$1$2"
            },
            {
                // Render our panel when the view is active, after the last case.
                match: /(\i&&(\i)===\i\.\i\.KAOMOJI\?\(0,(\i)\.jsx\)\(\i,\{onSelect:\i\}\):null)/,
                replace: "$1,$2===$self.VIEW?(0,$3.jsx)($self.PickerPanel,{}):null"
            }
        ]
    }],

    chatBarButton: {
        icon: MashupIcon,
        render: MashupChatBarButton
    }
});
