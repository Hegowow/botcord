export interface DiscordBadgeSeed {
    id: string;
    description: string;
    icon: string;
    link: string | null;
}

const premium = "https://discord.com/settings/premium";

const boosterIcons = [
    "51040c70d4f20a921ad6674ff86fc95c",
    "0e4080d1d333bc7ad29ef6528b6f2fb7",
    "72bed924410c304dbe3d00a6e593ff59",
    "df199d2050d3ed4ebf84d64ae83989f8",
    "996b3e870e8a22ce519b3a50e6bdd52f",
    "991c9f39ee33d7537d9f408c3e53141e",
    "cb3ae83c15e970e8f3d410bc62cb8b99",
    "7142225d31238f6387d9f09efaa02759",
    "ec92202290b48d0879b7413d2dde3bab",
];

const boosterMonths = [1, 2, 3, 6, 9, 12, 15, 18, 24];

const tenureTiers: [number, string, string][] = [
    [1, "Bronze", "4f33c4a9c64ce221936bd256c356f91f"],
    [3, "Argent", "4514fab914bdbfb4ad2fa23df76121a6"],
    [6, "Or", "2895086c18d5531d499862e41d1155a6"],
    [12, "Platine", "0334688279c8359120922938dcb1d6f8"],
    [24, "Diamant", "0d61871f72bb9a33a7ae568c1fb4f20a"],
    [36, "Émeraude", "11e2d339068b55d3a506cff34d3780f3"],
    [60, "Rubis", "cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4"],
    [72, "Feu", "5b154df19c53dce2af92c9b61e6be5e2"],
];

export const discordBadges: DiscordBadgeSeed[] = [
    { id: "staff", description: "Discord Staff", icon: "5e74e9b61934fc1f67c65515d1f7e60d", link: "https://discord.com/company" },
    { id: "partner", description: "Partenaire Discord", icon: "3f9748e53446a137a052f3454e2de41e", link: "https://discord.com/partners" },
    { id: "certified_moderator", description: "Ancien du programme modérateurs", icon: "fee1624003e2fee35cb398e125dc479b", link: "https://discord.com/safety" },
    { id: "hypesquad", description: "HypeSquad Events", icon: "bf01d1073931f921909045f3a39fd264", link: "https://discord.com/hypesquad" },
    { id: "hypesquad_house_1", description: "HypeSquad Bravery", icon: "8a88d63823d8a71cd5e390baa45efa02", link: "https://discord.com/settings/hypesquad-online" },
    { id: "hypesquad_house_2", description: "HypeSquad Brilliance", icon: "011940fd013da3f7fb926e4a1cd2e618", link: "https://discord.com/settings/hypesquad-online" },
    { id: "hypesquad_house_3", description: "HypeSquad Balance", icon: "3aa41de486fa12454c3761e8e223442e", link: "https://discord.com/settings/hypesquad-online" },
    { id: "bug_hunter_level_1", description: "Chasseur de bugs Discord", icon: "2717692c7dca7289b35297368a940dd0", link: "https://support.discord.com/hc/en-us/articles/360046057772-Discord-Bugs" },
    { id: "bug_hunter_level_2", description: "Chasseur de bugs Discord (or)", icon: "848f79194d4be5ff5f81505cbd0ce1e6", link: "https://support.discord.com/hc/en-us/articles/360046057772-Discord-Bugs" },
    { id: "active_developer", description: "Développeur actif", icon: "6bdc42827a38498929a4920da12695d9", link: "https://support-dev.discord.com/hc/en-us/articles/10113997751447?ref=badge" },
    { id: "verified_developer", description: "Développeur de bot vérifié de la première heure", icon: "6df5892e0f35b051f8b61eace34f4967", link: null },
    { id: "early_supporter", description: "Soutien de la première heure", icon: "7060786766c9c840eb3019e725d2b358", link: premium },
    { id: "premium", description: "Abonné Nitro", icon: "2ba85e8026a8614b640c2837bcdfe21b", link: premium },
    ...boosterIcons.map((icon, index) => ({
        id: `guild_booster_lvl${index + 1}`,
        description: `Booster de serveur (${boosterMonths[index]} mois)`,
        icon,
        link: premium,
    })),
    ...tenureTiers.map(([months, tier, icon]) => ({
        id: `premium_tenure_${months}_month`,
        description: `Ancienneté Nitro : ${tier}`,
        icon,
        link: premium,
    })),
    { id: "legacy_username", description: "Ancien pseudo", icon: "6de6d34650760ba5551a79732e98ed60", link: null },
    { id: "bot_commands", description: "Prend en charge les commandes", icon: "6f9e37f9029ff57aef81db857890005e", link: "https://discord.com/blog/welcome-to-the-new-era-of-discord-apps?ref=badge" },
    { id: "automod", description: "Utilise AutoMod", icon: "f2459b691ac7453ed6039bbcfaccbfcd", link: null },
    { id: "quest_completed", description: "A terminé une quête", icon: "7d9ae358c8c5e118768335dbe68b4fb8", link: "https://discord.com/settings/inventory" },
    { id: "gifting", description: "Champion des cadeaux", icon: "8b7792c4f65953d3ff564f23429cb79e", link: null },
];
