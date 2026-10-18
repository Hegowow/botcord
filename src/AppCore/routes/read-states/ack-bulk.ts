import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/", (req, res) => {
    res.send();
});

export default app;
