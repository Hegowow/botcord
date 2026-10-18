import { Router } from "express";

const app = Router({ mergeParams: true });

app.patch("/", (req, res) => {
    res.status(204).send();
});

export default app;
