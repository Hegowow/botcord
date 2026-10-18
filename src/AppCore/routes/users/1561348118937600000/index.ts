import { Router } from "express";
import Branding from "src/AppCore/Branding";
import Constants from "src/AppCore/Constants";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

app.get("/", (req, res) => {
    res.send(Constants.UserDefaultPatch);
});

app.get("/profile", (req, res) => {
    res.send(Util.ProfilePatch(Constants.UserDefaultPatch, null, null, `${Branding.ProfileBio}\n${Branding.GithubRepoUrl}`));
});

app.all("/*", (req, res) => {
    res.status(404).send();
});

export default app;
