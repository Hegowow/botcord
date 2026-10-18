import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        guilds: [],
        total_count: 0,
        categories: [],
    });
});

export default app;
