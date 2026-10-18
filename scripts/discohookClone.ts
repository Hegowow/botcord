/* Copyright Elysia © 2025 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const cloneDir = path.join(".", "discohook");

function runCommand(command: string, cwd?: string) {
    execSync(command, {
        stdio: "inherit",
        cwd,
    });
}

(async () => {
    // Clone or update discohook
    if (!fs.existsSync(cloneDir)) {
        console.log("> Cloning aiko-chan-ai/discohook...");
        runCommand(`git clone --depth 1 https://github.com/aiko-chan-ai/discohook.git ${cloneDir}`);
        console.log("> discohook clone complete.");
    } else {
        console.log("> discohook already exists, updating main branch...");
        try {
            runCommand("git fetch origin main", cloneDir);
            runCommand("git reset --hard origin/main", cloneDir);
            console.log("> discohook updated to latest main.");
        } catch (err) {
            console.error("> Failed to update discohook:", err);
        }
    }

    // Install dependencies
    console.log("> Installing discohook dependencies...");
    runCommand("npm install --force", cloneDir);
    console.log("> discohook dependencies installed.");
})();
