import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin, { IconProps, OptionType } from "@utils/types";
import type { User } from "@vencord/discord-types";
import { ContextMenuApi, Menu, showToast, Toasts, UserStore } from "@webpack/common";

import AdminPanel from "./AdminPanel";
import {
    ApiUrl,
    assignBadge,
    badgesForUser,
    getState,
    isAdmin,
    KahoBadge,
    registerClient,
    setAdminKey,
    startRefreshing,
    stopRefreshing,
    subscribe,
    unassignBadge,
    userHasBadge,
} from "./store";

const SettingsEntryKey = "kahocord_badges_admin";

const settings = definePluginSettings({
    adminKey: {
        type: OptionType.STRING,
        description: "Clé admin KahoCord. Laisse vide si tu n'es pas administrateur.",
        default: "",
        onChange: (value: string) => setAdminKey(value),
    },
});

function BadgesIcon({ width = 24, height = 24, className }: IconProps) {
    return <img src={`${ApiUrl}/files/kahocord-badge.png`} width={width} height={height} className={className} alt="" style={{ borderRadius: "50%" }} />;
}

function syncSettingsEntry() {
    const present = SettingsPlugin.customEntries.some(entry => entry.key === SettingsEntryKey);
    if (isAdmin() && !present) {
        SettingsPlugin.customEntries.push({
            key: SettingsEntryKey,
            title: "Gestion des badges",
            panelTitle: "Gestion des badges",
            Component: AdminPanel,
            Icon: BadgesIcon,
        });
    } else if (!isAdmin() && present) {
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === SettingsEntryKey);
    }
}

const profileBadge: ProfileBadge = {
    id: "kahocord-badges",
    getBadges: ({ userId }) =>
        badgesForUser(userId).map(badge => ({
            id: `kahocord-${badge.id}`,
            key: `kahocord-${badge.id}`,
            description: badge.description,
            iconSrc: badge.icon,
            link: badge.link ?? undefined,
            position: BadgePosition.START,
            props: { style: { borderRadius: badge.kind === "system" ? "50%" : undefined } },
        })),
};

async function toggleBadge(user: User, badge: KahoBadge) {
    const assigned = userHasBadge(user.id, badge.id);
    ContextMenuApi.closeContextMenu();
    try {
        if (assigned) await unassignBadge(user.id, badge.id);
        else await assignBadge(user.id, badge.id);
        showToast(
            assigned ? `Badge « ${badge.description} » retiré à ${user.username}` : `Badge « ${badge.description} » ajouté à ${user.username}`,
            Toasts.Type.SUCCESS,
        );
    } catch (error) {
        showToast((error as Error).message, Toasts.Type.FAILURE);
    }
}

function badgeItems(user: User, badges: KahoBadge[]) {
    return badges.map(badge => (
        <Menu.MenuCheckboxItem
            key={badge.id}
            id={`kahocord-badge-${badge.id}`}
            label={badge.description}
            checked={userHasBadge(user.id, badge.id)}
            action={() => toggleBadge(user, badge)}
        />
    ));
}

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    const state = getState();
    if (!isAdmin() || !user || !state) return;
    const custom = state.badges.filter(badge => badge.kind === "custom");
    const discord = state.badges.filter(badge => badge.kind === "discord");
    children.push(
        <Menu.MenuGroup key="kahocord-badges">
            <Menu.MenuItem id="kahocord-badges" label="Badges KahoCord">
                {custom.length ? (
                    <Menu.MenuGroup label="Badges personnalisés">{badgeItems(user, custom)}</Menu.MenuGroup>
                ) : (
                    <Menu.MenuItem id="kahocord-badges-empty" label="Aucun badge personnalisé" disabled />
                )}
                <Menu.MenuGroup>
                    <Menu.MenuItem id="kahocord-badges-discord" label="Badges Discord">
                        {badgeItems(user, discord)}
                    </Menu.MenuItem>
                </Menu.MenuGroup>
            </Menu.MenuItem>
        </Menu.MenuGroup>,
    );
};

let unsubscribe: (() => void) | null = null;

export default definePlugin({
    name: "KahoCordBadges",
    description: "Badges KahoCord : badge des utilisateurs KahoCord et gestion des badges personnalisés pour les admins",
    authors: [{ name: "kahodev", id: 0n }],
    required: true,
    dependencies: ["BadgeAPI"],
    settings,
    contextMenus: {
        "user-context": userContextPatch,
    },
    flux: {
        CONNECTION_OPEN() {
            const user = UserStore.getCurrentUser();
            if (!user) return;
            registerClient(user.id, (window.BotClientNative?.getAccountMode?.() ?? "bot") === "bot");
        },
    },
    start() {
        addProfileBadge(profileBadge);
        unsubscribe = subscribe(syncSettingsEntry);
        startRefreshing();
        if (settings.store.adminKey) setAdminKey(settings.store.adminKey);
    },
    stop() {
        removeProfileBadge(profileBadge);
        unsubscribe?.();
        stopRefreshing();
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === SettingsEntryKey);
    },
});
