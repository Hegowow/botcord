import { app, nativeImage } from "electron";
import path from "path";
import Branding from "src/AppCore/Branding";
import UserPatch from "src/AppUtils/UserPatch";

export default class Constants extends null {
    static BlacklistRoutes = [
        "outbound-promotions/codes",
        "science",
        "applications/public",
        "notes",
        "member-ids",
        "connections/",
        "users/@me/disable",
        "users/@me/delete",
        "users/@me/mfa",
        "users/@me/phone",
        "interaction-data",
        "member-verification",
        "cdn-cgi/challenge-platform",
        "explicit-media",
        "premium/subscriptions",
        "/ack",
        "/stripe",
        "/paypal",
        "/validate-billing-address",
        "/custom-call-sounds",
        "auth/conditional/start",
    ];
    static LatestStorageUpdate = 1735000000000;
    static AppName = Branding.AppName;
    static AppID = Branding.AppID;
    static iconPath = path.join(app.getAppPath(), "assets", "icon.png");
    static icon16 = nativeImage.createFromPath(Constants.iconPath).resize({ width: 16 });
    static icon128 = nativeImage.createFromPath(Constants.iconPath).resize({ width: 128 });
    static DiscordBackgroundColor = "#36393f";
    static GithubRepo = `${Branding.GithubUserName}/${Branding.GithubRepoName}`;
    static UserAgentDiscordBot = `DiscordBot (${Branding.GithubRepoUrl}, v${app.getVersion()})`;
    static VencordExtensionPath = path.join(app.getAppPath(), "VencordExtension");
    static DiscordHTMLPath = path.join(app.getAppPath(), "assets", "snapshot", "index.html");
    static ConfigEditorHTMLPath = path.join(app.getAppPath(), "assets", "config", "index.html");
    static EditorHTMLFolderPath = path.join(app.getAppPath(), "assets", "editor");
    static DiscordGuildExperimentsPath = path.join(app.getAppPath(), "assets", "snapshot", "guild_experiments.json");
    static DiscordUserExperimentsPath = path.join(app.getAppPath(), "assets", "snapshot", "user_experiments.json");
    static DiscordApexExperimentsPath = path.join(app.getAppPath(), "assets", "snapshot", "apex_experiments.json");
    static UserDefaultPatch = UserPatch[Branding.SystemUserId];
    static ChannelIdDefault = "1000000000000000000";
    static UserIdDefault = Branding.SystemUserId;
    static CustomDiscordDomain = "discord.com";
    static VerboseAPIServerLogging = true;
    static DirectMessages = {
        name: "DMsData",
        path: "DirectMessages",
    };
    static PreloadedUserSettings = {
        name: "UserSettingsProto1",
        path: "PreloadedUserSettings",
    };
    static FrecencyUserSettings = {
        name: "UserSettingsProto2",
        path: "FrecencyUserSettings",
    };
    static enableFeatures = [];
    static disableFeatures = [
        "CalculateNativeWinOcclusion",
        "OutOfBlinkCors",
        "WinRetrieveSuggestionsOnlyOnDemand",
        "HardwareMediaKeyHandling",
        "MediaSessionService",
    ];
}
