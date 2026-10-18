import { APIMessage, MessageType } from "discord-api-types/v10";
import Branding from "src/AppCore/Branding";
import Constants from "src/AppCore/Constants";

const ChangelogMessageType = 47 as MessageType;

export async function GetSystemMessage () {
    const authorAvatar = `${Branding.AuthorUrl}.png?size=128`;
    return [
        {
            id: "1000000000000000000",
            type: ChangelogMessageType,
            channel_id: Constants.ChannelIdDefault,
            author: Constants.UserDefaultPatch,
            attachments: [],
            content: "",
            embeds: [
                {
                    type: "rich",
                    title: `Bienvenue sur ${Branding.AppName} !`,
                    description: `### Tu es connecté avec ton bot, comme un utilisateur Discord classique.
Serveurs, salons, messages privés, vocal, embeds : tout passe par l'interface officielle de Discord, mais avec le token de ton bot.

🔒 Ton token reste sur ta machine. Ne le partage jamais et télécharge ${Branding.AppName} uniquement depuis le dépôt officiel.`,
                    color: Branding.AccentColor,
                    author: {
                        name: Branding.AppName,
                        icon_url: authorAvatar,
                        proxy_icon_url: authorAvatar,
                    },
                    thumbnail: {
                        url: authorAvatar,
                        width: 128,
                        height: 128,
                    },
                },
                {
                    type: "rich",
                    description: `Merci d'utiliser ${Branding.AppName} ✨
Un bug, une idée ? Ouvre une issue sur le dépôt GitHub.

Développé avec ❤️ par **${Branding.Author}**`,
                    color: Branding.AccentColor,
                    timestamp: "2026-10-18T12:00:00.000Z",
                    footer: {
                        text: Branding.Author,
                        icon_url: authorAvatar,
                    },
                },
            ],
            mentions: [],
            mention_roles: [],
            pinned: false,
            mention_everyone: false,
            tts: false,
            timestamp: new Date().toISOString(),
            edited_timestamp: null,
            flags: 16,
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5,
                            label: "Dépôt GitHub",
                            emoji: { name: "📦" },
                            url: Branding.GithubRepoUrl,
                        },
                        {
                            type: 2,
                            style: 5,
                            label: Branding.Author,
                            emoji: { name: "💜" },
                            url: Branding.AuthorUrl,
                        },
                        {
                            type: 2,
                            style: 5,
                            label: "Signaler un bug",
                            emoji: { name: "🐛" },
                            url: `${Branding.GithubRepoUrl}/issues`,
                        },
                    ],
                },
            ],
        },
    ] as APIMessage[];
}
