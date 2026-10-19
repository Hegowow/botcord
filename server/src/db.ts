import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { discordBadges, renamedDiscordBadges } from "./discordBadges.ts";

export type BadgeKind = "custom" | "discord" | "system";

export interface BadgeRow {
    id: string;
    kind: BadgeKind;
    description: string;
    icon: string;
    link: string | null;
    created_at: number;
}

export interface AdminKeyRow {
    id: number;
    label: string;
    key_hash: string;
    created_at: number;
    revoked_at: number | null;
}

const schema = `
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('custom', 'discord', 'system')),
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    link TEXT,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS clients (
    user_id TEXT PRIMARY KEY,
    is_bot INTEGER NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
);
`;

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export class Store {
    db: DatabaseSync;
    uploadsDir: string;
    revision = 0;

    constructor (dataDir: string) {
        fs.mkdirSync(dataDir, { recursive: true });
        this.uploadsDir = path.join(dataDir, "badges");
        fs.mkdirSync(this.uploadsDir, { recursive: true });
        this.db = new DatabaseSync(path.join(dataDir, "kahocord.sqlite"));
        this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
        this.db.exec(schema);
        this.seedDiscordBadges();
        this.revision = Date.now();
    }

    seedDiscordBadges () {
        const insert = this.db.prepare(
            "INSERT INTO badges (id, kind, description, icon, link, created_at) VALUES (?, 'discord', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET description = excluded.description, icon = excluded.icon, link = excluded.link WHERE badges.kind = 'discord'",
        );
        discordBadges.forEach((badge, index) => insert.run(`discord:${badge.id}`, badge.description, badge.icon, badge.link, index));
        for (const [oldId, newId] of Object.entries(renamedDiscordBadges)) {
            this.db.prepare("INSERT OR IGNORE INTO assignments (user_id, badge_id, created_at) SELECT user_id, ?, created_at FROM assignments WHERE badge_id = ?").run(`discord:${newId}`, `discord:${oldId}`);
        }
        const current = new Set(discordBadges.map(badge => `discord:${badge.id}`));
        const stale = (this.db.prepare("SELECT id FROM badges WHERE kind = 'discord'").all() as unknown as { id: string; }[]).filter(row => !current.has(row.id));
        for (const row of stale) this.db.prepare("DELETE FROM badges WHERE id = ?").run(row.id);
    }

    listeners = new Set<(revision: number) => void>();

    touch () {
        this.revision = Math.max(Date.now(), this.revision + 1);
        for (const listener of this.listeners) listener(this.revision);
    }

    onChange (listener: (revision: number) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    listBadges () {
        return this.db.prepare("SELECT * FROM badges ORDER BY kind = 'discord', created_at").all() as unknown as BadgeRow[];
    }

    getBadge (id: string) {
        return this.db.prepare("SELECT * FROM badges WHERE id = ?").get(id) as unknown as BadgeRow | undefined;
    }

    createCustomBadge (description: string, icon: string, link: string | null) {
        const id = `custom:${randomBytes(8).toString("hex")}`;
        this.db.prepare("INSERT INTO badges (id, kind, description, icon, link, created_at) VALUES (?, 'custom', ?, ?, ?, ?)").run(id, description, icon, link, Date.now());
        this.touch();
        return this.getBadge(id)!;
    }

    updateCustomBadge (id: string, changes: { description?: string; icon?: string; link?: string | null; }) {
        const current = this.getBadge(id);
        if (!current || current.kind !== "custom") return undefined;
        const next = { ...current, ...changes };
        this.db.prepare("UPDATE badges SET description = ?, icon = ?, link = ? WHERE id = ?").run(next.description, next.icon, next.link, id);
        this.touch();
        return { previous: current, badge: this.getBadge(id)! };
    }

    deleteCustomBadge (id: string) {
        const current = this.getBadge(id);
        if (!current || current.kind !== "custom") return undefined;
        this.db.prepare("DELETE FROM badges WHERE id = ?").run(id);
        this.touch();
        return current;
    }

    assign (userId: string, badgeId: string) {
        this.db.prepare("INSERT OR IGNORE INTO assignments (user_id, badge_id, created_at) VALUES (?, ?, ?)").run(userId, badgeId, Date.now());
        this.touch();
    }

    unassign (userId: string, badgeId: string) {
        this.db.prepare("DELETE FROM assignments WHERE user_id = ? AND badge_id = ?").run(userId, badgeId);
        this.touch();
    }

    assignments () {
        const rows = this.db.prepare("SELECT user_id, badge_id FROM assignments ORDER BY created_at").all() as unknown as { user_id: string; badge_id: string; }[];
        const result: Record<string, string[]> = {};
        for (const row of rows) (result[row.user_id] ??= []).push(row.badge_id);
        return result;
    }

    registerClient (userId: string, isBot: boolean) {
        const now = Date.now();
        const existing = this.db.prepare("SELECT user_id FROM clients WHERE user_id = ?").get(userId);
        this.db.prepare(
            "INSERT INTO clients (user_id, is_bot, first_seen, last_seen) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET is_bot = excluded.is_bot, last_seen = excluded.last_seen",
        ).run(userId, isBot ? 1 : 0, now, now);
        if (!existing) this.touch();
    }

    clientIds () {
        return (this.db.prepare("SELECT user_id FROM clients ORDER BY first_seen").all() as unknown as { user_id: string; }[]).map(row => row.user_id);
    }

    createAdminKey (label: string) {
        const key = `kc_admin_${randomBytes(32).toString("base64url")}`;
        this.db.prepare("INSERT INTO admin_keys (label, key_hash, created_at) VALUES (?, ?, ?)").run(label, hashKey(key), Date.now());
        return key;
    }

    listAdminKeys () {
        return this.db.prepare("SELECT * FROM admin_keys ORDER BY id").all() as unknown as AdminKeyRow[];
    }

    revokeAdminKey (id: number) {
        return this.db.prepare("UPDATE admin_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(Date.now(), id).changes > 0;
    }

    findAdmin (key: string | undefined) {
        if (!key || !key.startsWith("kc_admin_")) return undefined;
        const candidate = Buffer.from(hashKey(key), "hex");
        return this.listAdminKeys().find(row => {
            if (row.revoked_at) return false;
            const stored = Buffer.from(row.key_hash, "hex");
            return stored.length === candidate.length && timingSafeEqual(stored, candidate);
        });
    }
}
