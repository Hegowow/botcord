import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useEffect, useState } from "@webpack/common";

import { AccountMode, accountModeState } from "../utils/accountMode";
import AccountTypeSelect from "./AccountTypeSelect";
import { authBoxModule, cl, inputModule, tokenLabels } from "./AuthBoxTokenLogin";

export const multiTokenState = { value: "" };

export default function AuthBoxMultiTokenLogin() {
    const [state, setState] = useState("");
    const [mode, setMode] = useState<AccountMode>(accountModeState.value);
    const labels = tokenLabels[mode];

    useEffect(() => {
        multiTokenState.value = "";
        return () => {
            multiTokenState.value = "";
        };
    }, []);

    return (
        <>
            <div className={classes(authBoxModule.block, Margins.top20)}>
                <div className={Margins.bottom20}>
                    <h5 className={classes(cl("h5"), cl("defaultMarginh5"))}>
                        {labels.title}
                    </h5>
                    <div className={inputModule.inputWrapper}>
                        <input
                            className={inputModule.inputDefault}
                            name="token"
                            type="password"
                            placeholder={labels.placeholder}
                            aria-label="Token"
                            autoComplete="off"
                            maxLength={200}
                            spellCheck="false"
                            value={state}
                            onChange={ev => {
                                setState(ev.target.value);
                                multiTokenState.value = ev.target.value;
                            }}
                        />
                    </div>
                </div>
                <AccountTypeSelect
                    value={mode}
                    onChange={value => {
                        accountModeState.value = value;
                        setMode(value);
                    }}
                />
            </div>
        </>
    );
}
