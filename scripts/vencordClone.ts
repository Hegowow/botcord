import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const vencordVersion = "v1.15.0";
const cloneDir = path.join(".", "Vencord");
const pluginSourceDir = path.join(".", "plugin");
const userPluginDir = path.join(cloneDir, "src", "userplugins", "botClient");

function runCommand(command: string, cwd?: string) {
    execSync(command, {
        stdio: "inherit",
        cwd,
    });
}

function syncPlugin() {
    fs.rmSync(userPluginDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(userPluginDir), { recursive: true });
    fs.cpSync(pluginSourceDir, userPluginDir, { recursive: true });
    console.log("> Botcord plugin synced into Vencord.");
}

(async () => {
    if (!fs.existsSync(cloneDir)) {
        console.log(`> Cloning Vendicated/Vencord ${vencordVersion}...`);
        runCommand(`git clone --depth 1 --branch ${vencordVersion} https://github.com/Vendicated/Vencord.git ${cloneDir}`);
        console.log("> Vencord clone complete.");
    } else {
        console.log(`> Vencord already exists, checking out ${vencordVersion}...`);
        try {
            runCommand(`git fetch --depth 1 origin tag ${vencordVersion}`, cloneDir);
            runCommand(`git reset --hard ${vencordVersion}`, cloneDir);
            console.log(`> Vencord set to ${vencordVersion}.`);
        } catch (err) {
            console.error("> Failed to update Vencord:", err);
        }
    }

    syncPlugin();

    console.log("> Installing Vencord dependencies...");
    runCommand("npx pnpm install --frozen-lockfile", cloneDir);
    console.log("> Vencord dependencies installed.");
})();
