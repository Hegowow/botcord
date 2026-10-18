/* Copyright Elysia © 2025 */

import { spawn } from "child_process";
import path from "path";
import process from "process";
import { existsSync, renameSync, rmSync, readFileSync, writeFileSync } from "fs";

function runCommand(cmd: string, opts: { cwd?: string } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, [], {
            cwd: opts.cwd ?? process.cwd(),
            stdio: "inherit",
            shell: true,
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

async function buildDist() {
    const root = process.cwd();
    const dir = path.join(root, "discohook");

    console.log("➡️  Building discohook ...");
    await runCommand(
        "npm run build",
        {
            cwd: dir,
        },
    );
    console.log("✅ discohook build finished.");
}

function copyDist() {
    const root = process.cwd();
    const finalFolder = path.resolve(root, "assets", "editor");

    if (existsSync(finalFolder)) {
        rmSync(finalFolder, { recursive: true });
        console.info("Removed the old discohook folder:", finalFolder);
    }

    const discohookBuildPath = path.resolve(root, "discohook", "dist");
    renameSync(discohookBuildPath, finalFolder);

    console.info("Moved the newly built discohook folder to", finalFolder);
}

async function main() {
    try {
        await buildDist();
        copyDist();
        console.log("🎉 All done.");
    } catch (err) {
        console.error("❌ Build failed:", err);
        process.exitCode = 1;
    }
}

main();
