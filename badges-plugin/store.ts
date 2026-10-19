import { useEffect, useReducer } from "@webpack/common";

export const ApiUrl = "https://api.kaho.fr";
const ClientSecret = "kahocord-client";
const RefreshIntervalMs = 5 * 60 * 1000;

export type BadgeKind = "custom" | "discord" | "system";

export interface KahoBadge {
    id: string;
    kind: BadgeKind;
    description: string;
    icon: string;
    link: string | null;
}

export interface BadgeState {
    revision: number;
    badgeSize: number;
    badges: KahoBadge[];
    assignments: Record<string, string[]>;
    clients: string[];
}

export interface AdminSession {
    status: "none" | "checking" | "valid" | "invalid";
    label?: string;
    error?: string;
}

let state: BadgeState | null = null;
let badgeById = new Map<string, KahoBadge>();
let clientIds = new Set<string>();
let adminKey = "";
let admin: AdminSession = { status: "none" };
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let eventSource: EventSource | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

export function subscribe (listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useBadgeStore () {
    const [, rerender] = useReducer((value: number) => value + 1, 0);
    useEffect(() => subscribe(rerender), []);
    return { state, admin };
}

export const getState = () => state;
export const getAdmin = () => admin;
export const isAdmin = () => admin.status === "valid";

export function applyState (next: BadgeState) {
    state = next;
    badgeById = new Map(next.badges.map(badge => [badge.id, badge]));
    clientIds = new Set(next.clients);
    notify();
}

export function badgesForUser (userId: string) {
    if (!state) return [];
    const result: KahoBadge[] = [];
    const kahocord = badgeById.get("kahocord");
    if (kahocord && clientIds.has(userId)) result.push(kahocord);
    for (const id of state.assignments[userId] ?? []) {
        const badge = badgeById.get(id);
        if (badge) result.push(badge);
    }
    return result;
}

export function userHasBadge (userId: string, badgeId: string) {
    return state?.assignments[userId]?.includes(badgeId) ?? false;
}

export function countBadgeUsers (badgeId: string) {
    if (!state) return 0;
    if (badgeId === "kahocord") return state.clients.length;
    return Object.values(state.assignments).filter(ids => ids.includes(badgeId)).length;
}

async function request<T> (method: string, path: string, body?: unknown, withAdminKey = false): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (withAdminKey) headers.Authorization = `Bearer ${adminKey}`;
    if (path === "/v1/clients") headers["X-KahoCord-Client"] = ClientSecret;
    let response: Response;
    try {
        response = await fetch(ApiUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        throw new Error("Serveur KahoCord injoignable");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `Erreur ${response.status}`);
    return data as T;
}

export async function refresh () {
    try {
        applyState(await request<BadgeState>("GET", "/v1/state"));
    } catch (error) {
        console.warn("[KahoCordBadges] Impossible de charger les badges", error);
    }
}

function listenForChanges () {
    if (eventSource || typeof EventSource === "undefined") return;
    eventSource = new EventSource(`${ApiUrl}/v1/events`);
    eventSource.addEventListener("state", event => {
        try {
            const { revision } = JSON.parse((event as MessageEvent).data);
            if (revision !== state?.revision) refresh();
        } catch {
            refresh();
        }
    });
}

export function startRefreshing () {
    refresh();
    refreshTimer ??= setInterval(refresh, RefreshIntervalMs);
    listenForChanges();
}

export function stopRefreshing () {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    eventSource?.close();
    eventSource = null;
}

export async function registerClient (userId: string, bot: boolean) {
    try {
        const result = await request<{ revision: number; }>("POST", "/v1/clients", { userId, bot });
        if (!state || !clientIds.has(userId) || result.revision !== state.revision) await refresh();
    } catch (error) {
        console.warn("[KahoCordBadges] Enregistrement impossible", error);
    }
}

export async function setAdminKey (key: string) {
    adminKey = key.trim();
    if (!adminKey) {
        admin = { status: "none" };
        notify();
        return admin;
    }
    admin = { status: "checking" };
    notify();
    try {
        const session = await request<{ label: string; }>("GET", "/v1/admin/session", undefined, true);
        admin = { status: "valid", label: session.label };
    } catch (error) {
        admin = { status: "invalid", error: (error as Error).message };
    }
    notify();
    return admin;
}

async function adminCall (method: string, path: string, body?: unknown) {
    const result = await request<{ state: BadgeState; badge?: KahoBadge; }>(method, path, body, true);
    applyState(result.state);
    return result;
}

export const createBadge = (input: { description: string; link: string | null; image: string; }) => adminCall("POST", "/v1/admin/badges", input);

export const updateBadge = (id: string, input: { description?: string; link?: string | null; image?: string; }) =>
    adminCall("PATCH", `/v1/admin/badges/${encodeURIComponent(id)}`, input);

export const deleteBadge = (id: string) => adminCall("DELETE", `/v1/admin/badges/${encodeURIComponent(id)}`);

export const assignBadge = (userId: string, badgeId: string) =>
    adminCall("PUT", `/v1/admin/users/${userId}/badges/${encodeURIComponent(badgeId)}`);

export const unassignBadge = (userId: string, badgeId: string) =>
    adminCall("DELETE", `/v1/admin/users/${userId}/badges/${encodeURIComponent(badgeId)}`);
