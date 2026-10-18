import { spawn } from "child_process";
import path from "path";
import process from "process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, readFileSync, writeFileSync } from "fs";

function runCommand(cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: opts.cwd ?? process.cwd(),
            stdio: "inherit",
            shell: false,
        });

        child.on("error", err => reject(err));
        child.on("close", (code, signal) => {
            if (signal) {
                return reject(new Error(`Command terminated by signal ${signal}`));
            }
            if (code !== 0) {
                return reject(new Error(`Command exited with code ${code}`));
            }
            resolve();
        });
    });
}

function syncPlugin() {
    const root = process.cwd();
    const userPluginDir = path.join(root, "Vencord", "src", "userplugins", "botClient");
    rmSync(userPluginDir, { recursive: true, force: true });
    mkdirSync(path.dirname(userPluginDir), { recursive: true });
    cpSync(path.join(root, "plugin"), userPluginDir, { recursive: true });
    console.log("➡️  Botcord plugin synced into Vencord.");
}

async function buildVencord() {
    const root = process.cwd();
    const vencordDir = path.join(root, "Vencord");

    console.log("➡️  Building Vencord (web) ...");
    await runCommand(
        process.execPath,
        ["--require", "./scripts/suppressExperimentalWarnings.js", "scripts/build/buildWeb.mjs"],
        {
            cwd: vencordDir,
        },
    );
    console.log("✅ Vencord build finished.");
}

function copyAndPatch() {
    const root = process.cwd();
    const finalFolder = path.resolve(root, "VencordExtension");

    if (existsSync(finalFolder)) {
        rmSync(finalFolder, { recursive: true });
        console.info("Removed the old Vencord Extension folder:", finalFolder);
    }

    const vencordBuildPath = path.resolve(root, "Vencord", "dist", "chromium-unpacked");
    renameSync(vencordBuildPath, finalFolder);

    rmSync(path.resolve(root, "Vencord", "dist"), { recursive: true });
    console.info("Moved the newly built Vencord Extension folder to", finalFolder);

    const vencordPath = path.resolve(finalFolder, "dist", "Vencord.js");
    const vencordContent = readFileSync(vencordPath, "utf-8");

    const patchedVencord = vencordContent.replace(
        "getInfoRows(){",
        "getInfoRows(){let rows = this.getInfoRowsDefault();rows.unshift(`${window.BotClientNative.getBotClientName()} ${window.BotClientNative.getBotClientVersion()}`);return rows},getInfoRowsDefault(){",
    );

    if (patchedVencord === vencordContent) {
        console.info("Vencord.js is already patched / Cannot patch Vencord.js");
        console.info("Please check if the file is already patched or if the patch is correct.");
        process.exit(0);
    }

    writeFileSync(vencordPath, patchedVencord);
    console.info("Patched Vencord.js successfully");
}

async function main() {
    try {
        syncPlugin();
        await buildVencord();
        copyAndPatch();
        console.log("🎉 All done.");
    } catch (err) {
        console.error("❌ Build failed:", err);
        process.exitCode = 1;
    }
}

main();
