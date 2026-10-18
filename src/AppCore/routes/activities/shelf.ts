import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        activities: [],
        applications: [],
        assets: {},
    });
});

export default app;
