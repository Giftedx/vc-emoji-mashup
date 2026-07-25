import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

/**
 * Lives in its own module so MashupPicker can read settings without importing
 * index.tsx, which imports MashupPicker.
 */
export const settings = definePluginSettings({
    emojiSet: {
        type: OptionType.SELECT,
        description: "Artwork for the emoji you pick from. Mashups themselves are always Google's artwork and cannot be restyled.",
        options: [
            { label: "Twitter — matches Discord's own emoji", value: "twitter", default: true },
            { label: "Google — matches the mashup artwork", value: "google" },
            { label: "System — your OS emoji font", value: "system" }
        ]
    },
    sendMode: {
        type: OptionType.SELECT,
        description: "What clicking a mashup does",
        options: [
            { label: "Insert the URL into the message box", value: "insert", default: true },
            { label: "Copy the URL to the clipboard", value: "copy" }
        ]
    },
    autoClose: {
        type: OptionType.BOOLEAN,
        description: "Close the picker after choosing a mashup",
        default: true
    }
});
