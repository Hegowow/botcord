import { APIPublicThreadChannel, APIThreadList, APIThreadMember } from "discord-api-types/v10";
import { net } from "electron";
import { Request, Router } from "express";
import Constants from "src/AppCore/Constants";

const app = Router({ mergeParams: true });

const CACHE_MAX_SIZE = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface ThreadCacheEntry {
    timestamps: Set<number>;
    createdAt: number;
}

const mapCache = new Map<string, ThreadCacheEntry>();

function getOrCreateCacheEntry (channelId: string): Set<number> {
    const existing = mapCache.get(channelId);
    if (existing && Date.now() - existing.createdAt < CACHE_TTL_MS) {
        return existing.timestamps;
    }
    mapCache.delete(channelId);
    if (mapCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = mapCache.keys().next().value;
        if (oldestKey) mapCache.delete(oldestKey);
    }
    const entry: ThreadCacheEntry = { timestamps: new Set<number>(), createdAt: Date.now() };
    mapCache.set(channelId, entry);
    return entry.timestamps;
}

app.all(
    "/",
    async (
        req: Request<
            {
                id: string;
            },
            unknown,
            unknown,
            {
                archived?: "true" | "false";
                sort_by?: "last_message_time" | "archive_time" | "creation_time";
                sort_order?: "asc" | "desc";
                limit?: string;
                tag_setting?: "include" | "exclude" | "only";
                offset?: string;
                name?: string;
                tag?: string;
            }
        >,
        res,
    ) => {
        const channelId = req.params.id;
        let { sort_by, sort_order } = req.query;
        const { archived, tag_setting, name, tag, limit, offset } = req.query;
        sort_by = "archive_time";
        sort_order = "desc";
        if (tag || name) {
            return res.send({
                threads: [],
                members: [],
                has_more: false,
                total_results: 0,
                first_messages: [],
            });
        }
        let threads: APIPublicThreadChannel[] = [];
        let members: APIThreadMember[] = [];
        const first_messages: unknown[] = [];
        const public_has_more = false;
        const set = getOrCreateCacheEntry(channelId);
        const before = Array.from(set)[Math.max((parseInt(offset || "0", 10) || 0) - 1, 0)];
        if (archived === "true") {
            const publicThread = await net
                .fetch(
                    `https://canary.discord.com/api/v9/channels/${channelId}/threads/archived/public?limit=${parseInt(limit || "25") || 25}${
                        before ? `&before=${new Date(before).toISOString()}` : ""
                    }`,
                    {
                        headers: {
                            authorization: req.headers.authorization,
                            "user-agent": Constants.UserAgentDiscordBot,
                        } as Record<string, string>,
                    },
                )
                .then(r => r.json() as Promise<APIThreadList>);
            threads = (publicThread.threads as APIPublicThreadChannel[]) || [];
            members = publicThread.members || [];
        }
        for (let i = 0; i < threads.length; i++) {
            const timestamp = threads[i].thread_metadata?.archive_timestamp ?? 0;
            set.add(new Date(timestamp).getTime());
        }
        const finalData = {
            threads: threads,
            members,
            has_more: public_has_more,
            total_results: set.size,
            first_messages,
        };
        res.send(finalData);
    },
);

export default app;
