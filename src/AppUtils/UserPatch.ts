import { APIUser } from "discord-api-types/v10";
import Branding from "src/AppCore/Branding";

export default {
    [Branding.SystemUserId]: {
        id: Branding.SystemUserId,
        username: Branding.SystemUserName,
        global_name: Branding.SystemUserDisplayName,
        avatar: Branding.SystemUserAvatar,
        avatar_decoration: null,
        discriminator: "0000",
        public_flags: 1,
        flags: 1,
        bot: true,
        system: true,
        banner: null,
        accent_color: null,
    },
} as Record<string, APIUser>;
