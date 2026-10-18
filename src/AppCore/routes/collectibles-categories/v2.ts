import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({ categories: [], collections: [] });
});

export default app;
