import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.redirect("/app");
});

export default app;
