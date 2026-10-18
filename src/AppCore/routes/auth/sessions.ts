import { Router } from "express";
import Branding from "src/AppCore/Branding";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        user_sessions: [
            {
                id_hash: Buffer.from(`${Branding.GithubUserName}/${Branding.GithubRepoName}`, "utf8").toString("base64"),
                approx_last_used_time: new Date().toISOString(),
                client_info: {
                    os: process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux",
                    platform: Branding.AppName,
                    location: Branding.SessionLocation,
                },
            },
        ],
    });
});

export default app;
