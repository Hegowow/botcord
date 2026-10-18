import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        eligible_for_admin_server: false,
    });
});

export default app;
