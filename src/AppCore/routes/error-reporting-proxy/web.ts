import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/", (req, res) => {
    res.send({
        code: 0,
        message: "OK",
    });
});

export default app;
