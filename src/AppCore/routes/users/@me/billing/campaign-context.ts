import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send([
        {
            campaign: 2,
            is_eligible: false,
        },
    ]);
});

export default app;
