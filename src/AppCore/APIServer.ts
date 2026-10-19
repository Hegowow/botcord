import { scope } from "electron-log";
import express from "express";
import { readFileSync } from "fs";
import https from "https";
import morgan from "morgan";
import { type AddressInfo } from "net";
import path from "path";
import { registerRoutesSync } from "src/AppUtils/RegisterRoutes";
import Util from "src/AppUtils/Utils";

import AccountMode from "./AccountMode";
import BrandedAssets from "./BrandedAssets";
import Constants from "./Constants";

const logger = scope("APIServer");

const app = express();

if (Constants.VerboseAPIServerLogging) {
    app.use(
        morgan("dev", {
            stream: {
                write: msg => logger.info(msg.replace(/\n/g, "")),
            },
        }),
    );
}

const HttpsOptions = Util.generateSelfSignedCertificate();

const server = https.createServer(
    {
        key: HttpsOptions.private,
        cert: HttpsOptions.cert,
    },
    app,
);

const ignoreHeaders = ["cookie", "sec-", "referer", "origin", "authorization", "host"];

app.all("*", function (req, res, next) {
    req.originalHeaders = req.headers;
    const headers: typeof req.headers = {};
    Object.keys(req.headers).forEach(key => {
        if (!ignoreHeaders.some(prefix => key.toLowerCase().startsWith(prefix))) {
            headers[key] = req.headers[key];
        }
    });
    const token = req.headers.authorization?.trim().replace(/^Bot\s+/i, "");
    req.accountMode = AccountMode.requestMode(token ? Util.getIDFromToken(token) : null);
    if (token && req.accountMode !== "bot") {
        headers.authorization = token;
    } else if (token) {
        headers.authorization = `Bot ${token}`;
        headers["user-agent"] = Constants.UserAgentDiscordBot;
    }
    req.headers = headers;
    next();
});

app.use(BrandedAssets);

app.use((req, res, next) => {
    if (req.accountMode !== "bot" && req.originalUrl.includes("/api/")) return Util.proxy(req, res);
    next();
});

registerRoutesSync(app, path.resolve(__dirname, "routes"), ["/api/v10", "/api/v9", "/api"]);

app.all("/developers/*", (req, res) => {
    return res.redirect("/app");
});

app.use((req, res, next) => {
    if (req.originalUrl.endsWith(".map")) return res.status(404).send();
    if (Constants.BlacklistRoutes.some(_ => req.originalUrl.includes(_))) {
        return res.status(403).send({
            message: "APIServer: Bots cannot use this endpoint",
            code: 20001,
        });
    }
    if (req.originalUrl.includes("/api/")) return Util.proxy(req, res);
    if (["/", "/app", "/login"].includes(req.path) || ["/channels/"].some(s => req.path.startsWith(s))) {
        logger.log("Serving Discord HTML for route:", req.path);
        return res.send(readFileSync(Constants.DiscordHTMLPath, "utf8"));
    }
    req.headers = req.originalHeaders;
    return Util.proxy(req, res);
});

export default async function startAppServer (): Promise<number> {
    return new Promise((resolve, reject) => {
        const callback = () => {
            const address = server.address() as AddressInfo;
            resolve(address.port);
            logger.log(`API Server listening on https://localhost:${address.port}`);
        };
        server.listen(0, "127.0.0.1").once("listening", callback);
        server.on("error", reject);
    });
}
