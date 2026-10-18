import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useEffect, useState } from "@webpack/common";

import { authBoxModule, cl, inputModule } from "./AuthBoxTokenLogin";

export const multiTokenState = { value: "" };

export default function AuthBoxMultiTokenLogin() {
    const [state, setState] = useState("");

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
                        Bot Token
                    </h5>
                    <div className={inputModule.inputWrapper}>
                        <input
                            className={inputModule.inputDefault}
                            name="token"
                            type="password"
                            placeholder="Enter your bot token"
                            aria-label="Token"
                            autoComplete="off"
                            maxLength={100}
                            spellCheck="false"
                            value={state}
                            onChange={ev => {
                                setState(ev.target.value);
                                multiTokenState.value = ev.target.value;
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
