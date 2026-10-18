import "express";

import type { IncomingHttpHeaders } from "http";

import type { DiscordBotClient } from "./AppCore";

declare module "express-serve-static-core" {
    interface Request {
        originalHeaders: IncomingHttpHeaders;
        rawBody?: string;
    }
}

declare global {
    interface BigInt {
        toJSON(): string;
    }
    interface Window {
        Dexie: unknown;
    }
    var botClient: DiscordBotClient;
}
