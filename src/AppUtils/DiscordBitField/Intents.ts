import { GatewayIntentBits } from "discord-api-types/v10";

import { BitField } from "./BitField";

export class IntentsBitField extends BitField {
    static Flags = GatewayIntentBits;

    static getIntents (...removeIntents: GatewayIntentBits[]): number {
        const allIntents = Object.values(GatewayIntentBits).filter(v => typeof v === "number") as number[];
        let intents = allIntents.reduce((acc, bit) => acc | bit, 0);
        for (const remove of removeIntents) {
            intents &= ~remove;
        }
        return intents;
    }
}

