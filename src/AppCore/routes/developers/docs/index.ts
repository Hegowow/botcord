import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("*", (req, res) => {
    res.redirect("https://discord.com/developers/docs/intro");
});

export default app;
