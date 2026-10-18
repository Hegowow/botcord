import { Router } from "express";
import Branding from "src/AppCore/Branding";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        code: 0,
        message: "OK",
        version: globalThis.botClient.app.getVersion(),
        isBotClient: req.headers["user-agent"]?.includes(Branding.AppName) || false,
    });
});

export default app;
