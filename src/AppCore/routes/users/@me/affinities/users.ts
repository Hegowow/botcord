import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({ user_affinities: [], inverse_user_affinities: [] });
});

export default app;
