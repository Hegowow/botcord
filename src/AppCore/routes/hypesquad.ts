import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/online", (req, res) => {
    res.send();
});

export default app;
