import { createHash } from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import type { BadgeRow, Store } from "./db.ts";

export interface AppOptions {
    store: Store;
    publicUrl: string;
    clientSecret: string;
    allowedOrigins: string[];
    assetsDir: string;
    badgeSize: number;
    maxImageBytes: number;
    kahocordBadge: { id: string; description: string; link: string; };
}

class HttpError extends Error {
    status: number;

    constructor (status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const snowflakePattern = /^\d{15,21}$/;
const badgeFilePattern = /^[0-9a-f]{64}\.png$/;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function rateLimiter (limit: number, windowMs: number) {
    const hits = new Map<string, { count: number; reset: number; }>();
    return (key: string) => {
        const now = Date.now();
        const entry = hits.get(key);
        if (!entry || entry.reset < now) {
            hits.set(key, { count: 1, reset: now + windowMs });
            if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
            return true;
        }
        entry.count++;
        return entry.count <= limit;
    };
}

async function readJson (req: IncomingMessage, maxBytes: number) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) throw new HttpError(413, "Requête trop volumineuse");
        chunks.push(chunk);
    }
    if (!size) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    } catch {
        throw new HttpError(400, "JSON invalide");
    }
}

function parseDescription (value: unknown) {
    if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "Le titre du badge est obligatoire");
    const description = value.trim();
    if (description.length > 100) throw new HttpError(400, "Le titre du badge ne doit pas dépasser 100 caractères");
    return description;
}

function parseLink (value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") throw new HttpError(400, "Lien invalide");
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        throw new HttpError(400, "Lien invalide");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "Le lien doit commencer par http:// ou https://");
    return url.toString();
}

export function createApp (options: AppOptions) {
    const { store } = options;
    const uploadLimiter = rateLimiter(60, 60_000);
    const clientLimiter = rateLimiter(30, 60_000);
    const failedAuthLimiter = rateLimiter(20, 15 * 60_000);
    const kahocordIconPath = path.join(options.assetsDir, "kahocord-badge.png");
    const eventStreams = new Set<ServerResponse>();
    const maxEventStreams = 5000;

    store.onChange(revision => {
        const payload = `event: state\ndata: ${JSON.stringify({ revision })}\n\n`;
        for (const stream of eventStreams) stream.write(payload);
    });

    const heartbeat = setInterval(() => {
        for (const stream of eventStreams) stream.write(": ping\n\n");
    }, 25_000);
    heartbeat.unref();

    function openEventStream (req: IncomingMessage, res: ServerResponse) {
        if (eventStreams.size >= maxEventStreams) throw new HttpError(503, "Trop de connexions");
        res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        res.write(`retry: 5000\nevent: state\ndata: ${JSON.stringify({ revision: store.revision })}\n\n`);
        eventStreams.add(res);
        req.on("close", () => eventStreams.delete(res));
    }

    const iconUrl = (badge: BadgeRow) =>
        badge.kind === "discord" ? `https://cdn.discordapp.com/badge-icons/${badge.icon}.png` : `${options.publicUrl}/files/badges/${badge.icon}`;

    const serializeBadge = (badge: BadgeRow) => ({
        id: badge.id,
        kind: badge.kind,
        description: badge.description,
        icon: iconUrl(badge),
        link: badge.link,
    });

    const kahocordBadge = () => ({
        id: options.kahocordBadge.id,
        kind: "system",
        description: options.kahocordBadge.description,
        icon: `${options.publicUrl}/files/kahocord-badge.png`,
        link: options.kahocordBadge.link,
    });

    function saveImage (value: unknown) {
        if (typeof value !== "string") throw new HttpError(400, "Image manquante");
        const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
        if (!match) throw new HttpError(400, "L'image doit être un PNG");
        const buffer = Buffer.from(match[1], "base64");
        if (buffer.length > options.maxImageBytes) throw new HttpError(413, "Image trop lourde (256 Ko maximum)");
        if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature) || buffer.toString("ascii", 12, 16) !== "IHDR") {
            throw new HttpError(400, "Fichier PNG invalide");
        }
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width !== options.badgeSize || height !== options.badgeSize) {
            throw new HttpError(400, `L'image doit faire ${options.badgeSize}×${options.badgeSize} pixels`);
        }
        const name = `${createHash("sha256").update(buffer).digest("hex")}.png`;
        const target = path.join(store.uploadsDir, name);
        if (!fs.existsSync(target)) fs.writeFileSync(target, buffer);
        return name;
    }

    function removeImageIfUnused (name: string) {
        if (store.listBadges().some(badge => badge.kind === "custom" && badge.icon === name)) return;
        fs.rmSync(path.join(store.uploadsDir, name), { force: true });
    }

    function state () {
        return {
            revision: store.revision,
            badgeSize: options.badgeSize,
            badges: [kahocordBadge(), ...store.listBadges().map(serializeBadge)],
            assignments: store.assignments(),
            clients: store.clientIds(),
        };
    }

    function requireAdmin (req: IncomingMessage, ip: string) {
        const header = req.headers.authorization ?? "";
        const key = header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
        const admin = store.findAdmin(key);
        if (!admin) {
            if (!failedAuthLimiter(ip)) throw new HttpError(429, "Trop de tentatives, réessaie plus tard");
            throw new HttpError(401, "Clé admin invalide");
        }
        return admin;
    }

    function requireUserId (value: string) {
        if (!snowflakePattern.test(value)) throw new HttpError(400, "Identifiant Discord invalide");
        return value;
    }

    function requireAssignableBadge (id: string) {
        const badge = store.getBadge(id);
        if (!badge) throw new HttpError(404, "Badge introuvable");
        return badge;
    }

    function setCors (req: IncomingMessage, res: ServerResponse) {
        const origin = req.headers.origin;
        if (origin && options.allowedOrigins.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-KahoCord-Client");
            res.setHeader("Access-Control-Max-Age", "600");
        }
    }

    function sendJson (res: ServerResponse, status: number, body: unknown) {
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify(body));
    }

    function sendFile (res: ServerResponse, file: string, maxAge: number) {
        if (!fs.existsSync(file)) throw new HttpError(404, "Fichier introuvable");
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": `public, max-age=${maxAge}`, "Access-Control-Allow-Origin": "*" });
        res.end(fs.readFileSync(file));
    }

    async function route (req: IncomingMessage, res: ServerResponse, ip: string) {
        const url = new URL(req.url ?? "/", "http://localhost");
        const method = req.method ?? "GET";
        const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

        if (method === "OPTIONS") {
            res.writeHead(204);
            return res.end();
        }

        if (method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true });

        if (method === "GET" && url.pathname === "/files/kahocord-badge.png") return sendFile(res, kahocordIconPath, 3600);

        if (method === "GET" && parts[0] === "files" && parts[1] === "badges" && parts.length === 3) {
            if (!badgeFilePattern.test(parts[2])) throw new HttpError(404, "Fichier introuvable");
            return sendFile(res, path.join(store.uploadsDir, parts[2]), 31536000);
        }

        if (method === "GET" && url.pathname === "/v1/state") return sendJson(res, 200, state());

        if (method === "GET" && url.pathname === "/v1/events") return openEventStream(req, res);

        if (method === "POST" && url.pathname === "/v1/clients") {
            if (req.headers["x-kahocord-client"] !== options.clientSecret) throw new HttpError(403, "Client non reconnu");
            if (!clientLimiter(ip)) throw new HttpError(429, "Trop de requêtes");
            const body = await readJson(req, 4096);
            const userId = requireUserId(String(body.userId ?? ""));
            store.registerClient(userId, body.bot === true);
            return sendJson(res, 200, { ok: true, revision: store.revision });
        }

        if (parts[0] === "v1" && parts[1] === "admin") {
            const admin = requireAdmin(req, ip);
            if (!uploadLimiter(`admin:${admin.id}`)) throw new HttpError(429, "Trop de requêtes");

            if (method === "GET" && parts.length === 3 && parts[2] === "session") {
                return sendJson(res, 200, { label: admin.label });
            }

            if (method === "POST" && parts.length === 3 && parts[2] === "badges") {
                const body = await readJson(req, options.maxImageBytes * 2);
                const description = parseDescription(body.description);
                const link = parseLink(body.link);
                const badge = store.createCustomBadge(description, saveImage(body.image), link);
                return sendJson(res, 201, { badge: serializeBadge(badge), state: state() });
            }

            if (parts.length === 4 && parts[2] === "badges") {
                const id = parts[3];
                if (method === "PATCH") {
                    const body = await readJson(req, options.maxImageBytes * 2);
                    const changes: { description?: string; icon?: string; link?: string | null; } = {};
                    if ("description" in body) changes.description = parseDescription(body.description);
                    if ("link" in body) changes.link = parseLink(body.link);
                    if ("image" in body && body.image) changes.icon = saveImage(body.image);
                    const result = store.updateCustomBadge(id, changes);
                    if (!result) throw new HttpError(404, "Badge personnalisé introuvable");
                    if (result.previous.icon !== result.badge.icon) removeImageIfUnused(result.previous.icon);
                    return sendJson(res, 200, { badge: serializeBadge(result.badge), state: state() });
                }
                if (method === "DELETE") {
                    const removed = store.deleteCustomBadge(id);
                    if (!removed) throw new HttpError(404, "Badge personnalisé introuvable");
                    removeImageIfUnused(removed.icon);
                    return sendJson(res, 200, { state: state() });
                }
            }

            if (parts.length === 6 && parts[2] === "users" && parts[4] === "badges") {
                const userId = requireUserId(parts[3]);
                const badge = requireAssignableBadge(parts[5]);
                if (method === "PUT") {
                    store.assign(userId, badge.id);
                    return sendJson(res, 200, { state: state() });
                }
                if (method === "DELETE") {
                    store.unassign(userId, badge.id);
                    return sendJson(res, 200, { state: state() });
                }
            }
        }

        throw new HttpError(404, "Route introuvable");
    }

    return async (req: IncomingMessage, res: ServerResponse) => {
        const forwarded = req.headers["x-forwarded-for"];
        const ip = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded)?.split(",").pop()?.trim() || req.socket.remoteAddress || "unknown";
        setCors(req, res);
        try {
            await route(req, res, ip);
        } catch (error) {
            if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
            console.error(error);
            if (!res.headersSent) sendJson(res, 500, { error: "Erreur interne" });
        }
    };
}
