import Dexie, { type EntityTable,type Transaction } from "dexie";

import type {
    FrecencyUserSettings,
    PreloadedUserSettings,
} from "./proto";

export interface Channel {
    channelId: string;
    botId: string;
    data: Record<string, any>;
}

export interface PreloadedUserSettingsEntry {
    botId: string;
    data: PreloadedUserSettings;
}

export interface FrecencyUserSettingsEntry {
    botId: string;
    data: FrecencyUserSettings;
}

export type DexieExtended = Dexie & {
    PrivateChannel: EntityTable<Channel, "channelId">;
    PreloadedUserSettings: EntityTable<PreloadedUserSettingsEntry, "botId">;
    FrecencyUserSettings: EntityTable<FrecencyUserSettingsEntry, "botId">;
};

const schemaV1 = {
    PrivateChannel: "channelId, botId",
    PreloadedUserSettings: "botId",
    FrecencyUserSettings: "botId",
};

function migrateToVersion2(transaction: Transaction) {
    return transaction
        .table<PreloadedUserSettingsEntry>("PreloadedUserSettings")
        .clear();
}

export function registerMigrations(database: Dexie) {
    database.version(1).stores(schemaV1);
    database.version(2)
        .stores(schemaV1)
        .upgrade(migrateToVersion2);
}
