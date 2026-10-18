import { Router } from "express";

const app = Router({ mergeParams: true });

app.all("/", (req, res) => {
    res.send({
        application_commands: [],
        applications: [],
        cursor: null,
    });
});

export default app;
