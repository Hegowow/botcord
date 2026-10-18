import { APIApplication, APIGuildMember, APIUser } from "discord-api-types/v10";
import { net } from "electron";
import { Request, Router } from "express";
import Constants from "src/AppCore/Constants";
import Util from "src/AppUtils/Utils";

const app = Router({ mergeParams: true });

app.get(
    "/",
    async (
        req: Request<
            unknown,
            unknown,
            unknown,
            {
                guild_id?: string;
            }
        >,
        res,
    ) => {
        const { guild_id } = req.query;
        let guild_member = null;
        if (guild_id) {
            const body: Record<string, unknown> = {
                avatar_decoration_id: null,
            };
            guild_member = await net
                .fetch(`https://canary.discord.com/api/v10/guilds/${guild_id}/members/@me`, {
                    headers: {
                        authorization: req.headers.authorization,
                        "user-agent": Constants.UserAgentDiscordBot,
                        "Content-Type": "application/json",
                    } as Record<string, string>,
                    method: "PATCH",
                    body: JSON.stringify(body),
                })
                .then(r => r.json() as Promise<APIGuildMember>);
        }
        let applicationBio: string | null = null;
        try {
            const applicationData = await net
                .fetch("https://canary.discord.com/api/v9/applications/@me", {
                    headers: {
                        Authorization: req.headers.authorization,
                        "User-Agent": Constants.UserAgentDiscordBot,
                    } as Record<string, string>,
                })
                .then(resFetch => {
                    return resFetch.json() as Promise<APIApplication>;
                });
            applicationBio = applicationData.description;
        } catch (err) {
            console.error("Error fetching application data:", err);
        }
        net.fetch("https://canary.discord.com/api/v9/users/@me", {
            headers: {
                authorization: req.headers.authorization,
                "user-agent": Constants.UserAgentDiscordBot,
            } as Record<string, string>,
        })
            .then(r => r.json() as Promise<APIUser>)
            .then(d => res.send(Util.ProfilePatch(d, guild_member, guild_id, applicationBio)))
            .catch(err => {
                console.error("Error fetching user profile (@me):", err);
                if (!res.headersSent) res.status(500).send({ message: "Internal Server Error" });
            });
    },
);

export default app;
