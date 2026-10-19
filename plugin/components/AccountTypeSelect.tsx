import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { Select } from "@webpack/common";

import { AccountMode } from "../utils/accountMode";
import { cl } from "./AuthBoxTokenLogin";

const allOptions: { label: string; value: AccountMode; }[] = [
    { label: "Bot", value: "bot" },
    { label: "User", value: "user" },
    { label: "User (login)", value: "user-login" },
];

export default function AccountTypeSelect({ value, onChange, includeCredentialLogin = true }: {
    value: AccountMode;
    onChange(mode: AccountMode): void;
    includeCredentialLogin?: boolean;
}) {
    const options = includeCredentialLogin ? allOptions : allOptions.filter(option => option.value !== "user-login");
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
