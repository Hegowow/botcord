import { UserFlags } from "discord-api-types/v10";

import { BitField } from "./BitField";

export class UserFlagsBitField extends BitField {
    static Flags = UserFlags;
}

