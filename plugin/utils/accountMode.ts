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

export function userIdFromToken(token: string) {
    const [encoded] = token.replace(/^Bot\s+/i, "").split(".");
    try {
        const decoded = atob(encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "="));
        return /^\d{15,21}$/.test(decoded) ? decoded : null;
    } catch {
        return null;
    }
}

export function rememberAccount(userId: string | null | undefined, mode: AccountMode) {
    if (userId) window.BotClientNative.rememberAccountMode(userId, mode);
}

const isSameKind = (a: AccountMode, b: AccountMode) => (a === "bot") === (b === "bot");

export function handleAccountSwitch(token: string) {
    const userId = userIdFromToken(token);
    if (!userId) return false;
    const target: AccountMode = window.BotClientNative.getAccountModeFor(userId) ?? accountModeState.value;
    rememberAccount(userId, target);
    window.BotClientNative.setAccountMode(target);
    if (isSameKind(target, startupAccountMode)) return false;
    TokenStore.setToken(token, userId);
    setTimeout(() => location.reload(), 0);
    return true;
}

export function switchToToken(rawToken: string, mode: AccountMode) {
    const token = normalizeToken(rawToken, mode);
    accountModeState.value = mode;
    rememberAccount(userIdFromToken(token), mode);
    return LoginToken.switchAccountToken(token);
}

export function loginWithToken(rawToken: string, mode: AccountMode) {
    const token = normalizeToken(rawToken, mode);
    rememberAccount(userIdFromToken(token), mode);
    window.BotClientNative.setAccountMode(mode);
    originalSessionStorage.setItem("currentShard", "0");
    if (mode === startupAccountMode) return LoginToken.loginToken(token);
    TokenStore.setToken(token);
    location.reload();
}
