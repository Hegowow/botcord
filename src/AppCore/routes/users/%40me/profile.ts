import { APIUser } from "discord-api-types/v10";
import { net } from "electron";
import { Request, Response, Router } from "express";
import Constants from "src/AppCore/Constants";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

export interface ModifyCurrentUserProfile {
    pronouns?: string | null;
    bio?: string | null;
    banner?: string | null;
    accent_color?: number | null;
    theme_colors?: [number, number];
    popout_animation_particle_type?: string | null;
    emoji_id?: string | null;
    profile_effect_id?: string | null;
}

export const callbackEditCurrentUser = (
    reqCallback: Request<
        {
            id: string;
        },
        unknown,
        ModifyCurrentUserProfile
    >,
    resCallback: Response,
) => {
    const body: Record<string, unknown> = {};
    if ("banner" in reqCallback.body) body.banner = reqCallback.body.banner;
    net.fetch("https://canary.discord.com/api/v10/users/@me", {
        headers: {
            authorization: reqCallback.headers.authorization,
            "user-agent": Constants.UserAgentDiscordBot,
            "Content-Type": "application/json",
        } as Record<string, string>,
        method: "PATCH",
        body: JSON.stringify(body),
    })
        .then(r => r.json() as Promise<APIUser>)
        .then(d => {
            return resCallback.send({
                guild_id: null,
                pronouns: "",
                bio: null,
                banner: d.banner,
                accent_color: null,
                theme_colors: null,
                popout_animation_particle_type: null,
                emoji: null,
                profile_effect: null,
            });
        })
        .catch(err => {
            console.error("Error in /users/@me/profile PATCH (user):", err);
            if (!resCallback.headersSent) resCallback.status(500).send({ message: "Internal Server Error", code: 500 });
        });
};

app.patch("/", async (req, res) => {
    return Util.getDataFromRequest(req, res, callbackEditCurrentUser);
});

export default app;
