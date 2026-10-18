import { Router } from "express";

const app = Router({ mergeParams: true });

app.put("/", (req, res) => {
    res.status(403).send({
        message: "APIServer: User is not eligible to join this server.",
        code: 150023,
    });
});

export default app;
