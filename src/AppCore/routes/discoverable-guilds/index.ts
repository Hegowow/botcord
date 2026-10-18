import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        total: 0,
        guilds: [],
        offset: 0,
        limit: 100,
    });
});

export default app;
