import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        shop_blocks: [],
        categories: [],
    });
});

export default app;
