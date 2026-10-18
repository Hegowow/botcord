import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        users: [],
        next_index: 0,
    });
});

export default app;
