import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/*", (req, res) => {
    return res.status(403).send({
        message: "APIServer: Bots cannot use this endpoint",
        code: 20001,
    });
});

export default app;
