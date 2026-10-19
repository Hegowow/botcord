import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

export const config = {
    host: process.env.KAHOCORD_HOST ?? "127.0.0.1",
    port: Number(process.env.KAHOCORD_PORT ?? 8792),
    publicUrl: (process.env.KAHOCORD_PUBLIC_URL ?? "https://api.kaho.fr").replace(/\/$/, ""),
    dataDir: process.env.KAHOCORD_DATA_DIR ?? path.join(rootDir, "data"),
    clientSecret: process.env.KAHOCORD_CLIENT_SECRET ?? "kahocord-client",
    allowedOrigins: (process.env.KAHOCORD_ALLOWED_ORIGINS ?? "https://discord.com").split(",").map(origin => origin.trim()),
    assetsDir: path.join(rootDir, "assets"),
    badgeSize: 72,
    maxImageBytes: 256 * 1024,
    kahocordBadge: {
        id: "kahocord",
        description: "Utilisateur KahoCord",
        link: "https://www.linkedin.com/company/kaho/",
    },
};
