import { app } from "electron";
import fs from "fs";
import path from "path";

export type AccountMode = "bot" | "user";

class AccountModeStore {
    filePath = path.join(app.getPath("userData"), "account-mode.json");
    current: AccountMode = this.read();

    read (): AccountMode {
        try {
            const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
            return data.mode === "user" ? "user" : "bot";
        } catch {
            return "bot";
        }
    }

    set (mode: AccountMode) {
        this.current = mode === "user" ? "user" : "bot";
        fs.writeFileSync(this.filePath, JSON.stringify({ mode: this.current }), "utf-8");
        return this.current;
    }

    get isUser () {
        return this.current === "user";
    }
}

export default new AccountModeStore();
