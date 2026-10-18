import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.status(204).send();
});

export default app;
