import "./styles.css";

import { ChatBarButton, type ChatBarButtonFactory } from "@api/ChatButtons";
import { Devs } from "@utils/constants";
import { copyWithToast, insertTextIntoChatInputBox } from "@utils/discord";
import { ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { ExpressionPickerStore, Text } from "@webpack/common";

import { MashupPicker } from "./MashupPicker";
import { settings } from "./settings";

function handlePick(url: string) {
    if (settings.store.sendMode === "copy") {
        copyWithToast(url, "Mashup URL copied!");
    } else {
        insertTextIntoChatInputBox(url + " ");
    }

    if (settings.store.autoClose) ExpressionPickerStore.closeExpressionPicker();
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
        <ModalRoot {...props} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold">Emoji Mashup</Text>
            </ModalHeader>
            <ModalContent>
                <MashupPicker
                    onPick={url => {
                        handlePick(url);
                        props.onClose();
                    }}
                />
            </ModalContent>
        </ModalRoot>
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
    description: "Browse and send Google Emoji Kitchen mashups from the emoji picker",
    tags: ["Emoji", "Chat"],
    authors: [Devs.Ven],
    settings,

    // Populated once the expression-picker patch target is verified against a
    // running client. Until then the chat-bar button below is the mount.
    patches: [],

    /** Consumed by the expression-picker patch, when there is one. */
    renderPicker: () => <MashupPicker onPick={handlePick} />,

    chatBarButton: {
        icon: MashupIcon,
        render: MashupChatBarButton
    }
});
