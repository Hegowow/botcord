import { Router } from "express";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send({
        linked_users: [],
        users: [],
        teen_audit_log: null,
        age_group: "adult",
    });
});

export default app;
