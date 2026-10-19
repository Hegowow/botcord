import { app } from "electron";
import fs from "fs";
import path from "path";

export type AccountMode = "bot" | "user" | "user-login";

const modes: AccountMode[] = ["bot", "user", "user-login"];

const parseMode = (value: unknown): AccountMode => (modes.includes(value as AccountMode) ? (value as AccountMode) : "bot");

class AccountModeStore {
    filePath = path.join(app.getPath("userData"), "account-mode.json");
    current: AccountMode = this.read();

    read (): AccountMode {
        try {
            const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
            return parseMode(data.mode);
        } catch {
            return "bot";
        }
    }

    set (mode: AccountMode) {
        this.current = parseMode(mode);
        fs.writeFileSync(this.filePath, JSON.stringify({ mode: this.current }), "utf-8");
        return this.current;
    }

    get isUser () {
        return this.current !== "bot";
    }
}

export default new AccountModeStore();
