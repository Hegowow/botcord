import { findByPropsLazy } from "@webpack";

import { originalSessionStorage } from "./common";

export type AccountMode = "bot" | "user" | "user-login";

const modes: AccountMode[] = ["bot", "user", "user-login"];

const nativeMode = window.BotClientNative?.getAccountMode?.();

export const startupAccountMode: AccountMode = modes.includes(nativeMode) ? nativeMode : "bot";

export const isBotMode = startupAccountMode === "bot";

export const isCredentialLoginMode = startupAccountMode === "user-login";

export const accountModeState = { value: startupAccountMode };

const LoginToken = findByPropsLazy("loginToken", "login");
const TokenStore = findByPropsLazy("getToken", "setToken");

export function normalizeToken(token: string, mode: AccountMode) {
    const trimmed = token.trim().replace(/^"|"$/g, "");
    return mode === "bot" ? trimmed.replace(/^Bot\s+/i, "") : trimmed;
}

export function switchLoginMode(mode: AccountMode) {
    if (mode === startupAccountMode) return;
    window.BotClientNative.setAccountMode(mode);
    location.reload();
}

export function loginWithToken(rawToken: string, mode: AccountMode) {
    const token = normalizeToken(rawToken, mode);
    window.BotClientNative.setAccountMode(mode);
    originalSessionStorage.setItem("currentShard", "0");
    if (mode === startupAccountMode) return LoginToken.loginToken(token);
    TokenStore.setToken(token);
    location.reload();
}
