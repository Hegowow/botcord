import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { Select } from "@webpack/common";

import { AccountMode } from "../utils/accountMode";
import { cl } from "./AuthBoxTokenLogin";

const options = [
    { label: "Bot", value: "bot" },
    { label: "Compte personnel", value: "user" },
];

export default function AccountTypeSelect({ value, onChange }: { value: AccountMode; onChange(mode: AccountMode): void; }) {
    return (
        <div className={Margins.bottom20}>
            <h5 className={classes(cl("h5"), cl("defaultMarginh5"))}>Type de compte</h5>
            <Select
                options={options}
                isSelected={option => option === value}
                select={option => onChange(option)}
                serialize={option => option}
                closeOnSelect
                popoutPosition="bottom"
            />
        </div>
    );
}
