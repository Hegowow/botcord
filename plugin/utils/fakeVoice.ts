import { findStoreLazy } from "@webpack";
import { ChannelStore, SelectedChannelStore, showToast, Toasts } from "@webpack/common";

import { originalSessionStorage } from "./common";

const MediaEngineStore: {
    isSelfMute: () => boolean;
    isSelfDeaf: () => boolean;
} = findStoreLazy("MediaEngineStore");

const GatewayConnectionStore: {
    getSocket: () => ({ send: (op: number, data: unknown) => void; }) | null;
} = findStoreLazy("GatewayConnectionStore");

export type FakeVoiceKind = "mute" | "deaf";

const StorageKey = "kahocordFakeVoice";

function restore () {
    try {
        const saved = JSON.parse(originalSessionStorage.getItem(StorageKey) || "{}");
        return { mute: saved.mute === true, deaf: saved.deaf === true };
    } catch {
        return { mute: false, deaf: false };
    }
}

export const fakeVoiceState = restore();

export const fakeVoiceLabels: Record<FakeVoiceKind, string> = {
    mute: "Faux micro coupé",
    deaf: "Faux casque coupé",
};

export function reportedVoiceState () {
    return {
        selfMute: fakeVoiceState.mute || MediaEngineStore.isSelfMute(),
        selfDeaf: fakeVoiceState.deaf || MediaEngineStore.isSelfDeaf(),
    };
}

export function resendVoiceState () {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) return false;
    const socket = GatewayConnectionStore.getSocket();
    if (!socket) return false;
    const { selfMute, selfDeaf } = reportedVoiceState();
    socket.send(4, {
        guild_id: ChannelStore.getChannel(channelId)?.guild_id ?? null,
        channel_id: channelId,
        self_mute: selfMute,
        self_deaf: selfDeaf,
        self_video: false,
    });
    return true;
}

export function toggleFakeVoice (kind: FakeVoiceKind) {
    fakeVoiceState[kind] = !fakeVoiceState[kind];
    try {
        originalSessionStorage.setItem(StorageKey, JSON.stringify(fakeVoiceState));
    } catch {
        return;
    }
    const inVoice = resendVoiceState();
    const label = fakeVoiceLabels[kind];
    if (!fakeVoiceState[kind]) {
        showToast(`${label} désactivé`, Toasts.Type.SUCCESS);
    } else {
        showToast(inVoice ? `${label} activé` : `${label} activé (actif au prochain salon vocal)`, Toasts.Type.SUCCESS);
    }
}
