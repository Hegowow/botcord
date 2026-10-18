import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        suggested_games: [],
        suggested_wishlist_games: [],
    });
});

export default app;
