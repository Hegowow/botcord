import { randomUUID } from "node:crypto";

import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        request_id: randomUUID(),
        decisions: [],
    });
});

export default app;
