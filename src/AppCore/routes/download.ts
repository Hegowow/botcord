import { Router } from "express";
import Branding from "src/AppCore/Branding";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    return res.redirect(`${Branding.GithubRepoUrl}/releases`);
});

export default app;
