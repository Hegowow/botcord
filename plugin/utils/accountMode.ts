import { findByPropsLazy } from "@webpack";

import { originalSessionStorage } from "./common";

export type AccountMode = "bot" | "user";

export const startupAccountMode: AccountMode = window.BotClientNative?.getAccountMode?.() === "user" ? "user" : "bot";

export const isBotMode = startupAccountMode === "bot";

export const accountModeState = { value: startupAccountMode };

const LoginToken = findByPropsLazy("loginToken", "login");
const TokenStore = findByPropsLazy("getToken", "setToken");

export function normalizeToken(token: string, mode: AccountMode) {
    const trimmed = token.trim().replace(/^"|"$/g, "");
    return mode === "bot" ? trimmed.replace(/^Bot\s+/i, "") : trimmed;
}

export function loginWithToken(rawToken: string, mode: AccountMode) {
    const token = normalizeToken(rawToken, mode);
    window.BotClientNative.setAccountMode(mode);
    originalSessionStorage.setItem("currentShard", "0");
    if (mode === startupAccountMode) return LoginToken.loginToken(token);
    TokenStore.setToken(token);
    location.reload();
}
