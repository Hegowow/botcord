import { app } from "electron";
import fs from "fs";
import path from "path";

export type AccountMode = "bot" | "user" | "user-login";

const modes: AccountMode[] = ["bot", "user", "user-login"];
const snowflakePattern = /^\d{15,21}$/;

const parseMode = (value: unknown): AccountMode => (modes.includes(value as AccountMode) ? (value as AccountMode) : "bot");

class AccountModeStore {
    filePath = path.join(app.getPath("userData"), "account-mode.json");
    current: AccountMode = "bot";
    accounts: Record<string, AccountMode> = {};

    constructor () {
        try {
            const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
            this.current = parseMode(data.mode);
            for (const [userId, mode] of Object.entries(data.accounts ?? {})) {
                if (snowflakePattern.test(userId)) this.accounts[userId] = parseMode(mode);
            }
        } catch {
            this.current = "bot";
        }
    }

    save () {
        fs.writeFileSync(this.filePath, JSON.stringify({ mode: this.current, accounts: this.accounts }), "utf-8");
    }

    set (mode: AccountMode) {
        this.current = parseMode(mode);
        this.save();
        return this.current;
    }

    remember (userId: string, mode: AccountMode) {
        if (!snowflakePattern.test(userId)) return;
        this.accounts[userId] = parseMode(mode);
        this.save();
    }

    modeFor (userId: string | null) {
        return userId ? this.accounts[userId] ?? null : null;
    }

    requestMode (userId: string | null) {
        return this.modeFor(userId) ?? this.current;
    }

    get isUser () {
        return this.current !== "bot";
    }
}

export default new AccountModeStore();
