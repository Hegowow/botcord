import { ApplicationFlags } from "discord-api-types/v10";

import { BitField } from "./BitField";

export class ApplicationFlagsBitField extends BitField {
    static override Flags = ApplicationFlags;
}

