import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { createApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { Store } from "../src/db.ts";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kahocord-test-"));
const store = new Store(dataDir);
const adminKey = store.createAdminKey("Test");
const server = http.createServer(createApp({ ...config, store, publicUrl: "https://api.example.test", clientSecret: "secret" }));
let base = "";

const validPng = `data:image/png;base64,${fs.readFileSync(path.join(config.assetsDir, "kahocord-badge.png")).toString("base64")}`;
const wrongSizePng = (() => {
    const buffer = Buffer.from(fs.readFileSync(path.join(config.assetsDir, "kahocord-badge.png")));
    buffer.writeUInt32BE(64, 16);
    return `data:image/png;base64,${buffer.toString("base64")}`;
})();

const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(base + route, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, json: await response.json().catch(() => null) };
};
const admin = { Authorization: `Bearer ${adminKey}` };

before(async () => {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
});

test("state exposes the KahoCord badge and Discord badges", async () => {
    const { status, json } = await call("GET", "/v1/state");
    assert.equal(status, 200);
    assert.equal(json.badges[0].id, "kahocord");
    assert.equal(json.badges[0].link, "https://www.linkedin.com/company/kaho/");
    assert.ok(json.badges.some((badge: { id: string; }) => badge.id === "discord:staff"));
});

test("client registration requires the client secret and a valid snowflake", async () => {
    assert.equal((await call("POST", "/v1/clients", { userId: "123456789012345678" })).status, 403);
    assert.equal((await call("POST", "/v1/clients", { userId: "abc" }, { "X-KahoCord-Client": "secret" })).status, 400);
    assert.equal((await call("POST", "/v1/clients", { userId: "123456789012345678", bot: true }, { "X-KahoCord-Client": "secret" })).status, 200);
    const { json } = await call("GET", "/v1/state");
    assert.deepEqual(json.clients, ["123456789012345678"]);
});

test("admin routes reject missing or wrong keys", async () => {
    assert.equal((await call("GET", "/v1/admin/session")).status, 401);
    assert.equal((await call("GET", "/v1/admin/session", undefined, { Authorization: "Bearer kc_admin_wrong" })).status, 401);
    const { status, json } = await call("GET", "/v1/admin/session", undefined, admin);
    assert.equal(status, 200);
    assert.equal(json.label, "Test");
});

test("custom badges require a 72x72 PNG, a title and a valid link", async () => {
    assert.equal((await call("POST", "/v1/admin/badges", { description: "Test", image: wrongSizePng }, admin)).status, 400);
    assert.equal((await call("POST", "/v1/admin/badges", { description: "", image: validPng }, admin)).status, 400);
    assert.equal((await call("POST", "/v1/admin/badges", { description: "Test", image: validPng, link: "javascript:alert(1)" }, admin)).status, 400);
    const created = await call("POST", "/v1/admin/badges", { description: "Fondateur", image: validPng, link: "https://kaho.fr" }, admin);
    assert.equal(created.status, 201);
    assert.match(created.json.badge.icon, /^https:\/\/api\.example\.test\/files\/badges\/[0-9a-f]{64}\.png$/);
    const file = created.json.badge.icon.split("/").pop();
    const image = await fetch(`${base}/files/badges/${file}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
});

test("badges can be assigned, updated, unassigned and deleted", async () => {
    const created = await call("POST", "/v1/admin/badges", { description: "Testeur", image: validPng }, admin);
    const id = created.json.badge.id;
    const user = "987654321098765432";
    let result = await call("PUT", `/v1/admin/users/${user}/badges/${encodeURIComponent(id)}`, undefined, admin);
    assert.deepEqual(result.json.state.assignments[user], [id]);
    result = await call("PUT", `/v1/admin/users/${user}/badges/discord%3Astaff`, undefined, admin);
    assert.deepEqual(result.json.state.assignments[user], [id, "discord:staff"]);
    assert.equal((await call("PUT", `/v1/admin/users/${user}/badges/kahocord`, undefined, admin)).status, 404);
    result = await call("PATCH", `/v1/admin/badges/${encodeURIComponent(id)}`, { description: "Testeur officiel", link: null }, admin);
    assert.equal(result.json.badge.description, "Testeur officiel");
    assert.equal((await call("DELETE", "/v1/admin/badges/discord%3Astaff", undefined, admin)).status, 404);
    result = await call("DELETE", `/v1/admin/users/${user}/badges/discord%3Astaff`, undefined, admin);
    assert.deepEqual(result.json.state.assignments[user], [id]);
    result = await call("DELETE", `/v1/admin/badges/${encodeURIComponent(id)}`, undefined, admin);
    assert.equal(result.json.state.assignments[user], undefined);
});

test("CORS is only granted to Discord", async () => {
    const allowed = await call("GET", "/v1/state", undefined, { Origin: "https://discord.com" });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://discord.com");
    const denied = await call("GET", "/v1/state", undefined, { Origin: "https://evil.example" });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("revoked admin keys stop working", async () => {
    const key = store.createAdminKey("Temporaire");
    const id = store.listAdminKeys().find(row => row.label === "Temporaire")!.id;
    assert.equal((await call("GET", "/v1/admin/session", undefined, { Authorization: `Bearer ${key}` })).status, 200);
    store.revokeAdminKey(id);
    assert.equal((await call("GET", "/v1/admin/session", undefined, { Authorization: `Bearer ${key}` })).status, 401);
});

test("event stream pushes a new revision when badges change", async () => {
    const controller = new AbortController();
    const response = await fetch(`${base}/v1/events`, { headers: { Origin: "https://discord.com" }, signal: controller.signal });
    assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://discord.com");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = decoder.decode((await reader.read()).value);
    assert.match(received, /event: state/);
    const before = store.revision;
    await call("PUT", "/v1/admin/users/111111111111111111/badges/discord%3Astaff", undefined, admin);
    while (!received.includes(`"revision":${store.revision}`) || store.revision === before) {
        received += decoder.decode((await reader.read()).value);
    }
    assert.ok(store.revision > before);
    controller.abort();
});

test("gifting badges expose the six Discord tiers", async () => {
    const { json } = await call("GET", "/v1/state");
    const ids = json.badges.map((badge: { id: string; }) => badge.id);
    for (const tier of ["patron", "champion", "luminary", "icon", "hero", "legend"]) assert.ok(ids.includes(`discord:gifting_${tier}`), tier);
    assert.ok(!ids.includes("discord:gifting"));
});

test("legacy gifting assignments move to the Champion tier", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kahocord-migration-"));
    const first = new Store(dir);
    first.db.prepare("INSERT INTO badges (id, kind, description, icon, link, created_at) VALUES ('discord:gifting', 'discord', 'old', 'x', NULL, 0)").run();
    first.assign("222222222222222222", "discord:gifting");
    first.db.close();
    const second = new Store(dir);
    assert.deepEqual(second.assignments()["222222222222222222"], ["discord:gifting_champion"]);
    assert.equal(second.getBadge("discord:gifting"), undefined);
    second.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
});
