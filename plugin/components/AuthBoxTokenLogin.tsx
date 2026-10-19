import "./AuthBoxTokenLogin.css";

import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { findByPropsLazy, findCssClassesLazy } from "@webpack";
import { useState } from "@webpack/common";

import { AccountMode, accountModeState, isCredentialLoginMode, loginWithToken, normalizeToken, startupAccountMode, switchLoginMode } from "../utils/accountMode";
import { RegExToken } from "../utils/common";
import AccountTypeSelect from "./AccountTypeSelect";

export const cl = classNameFactory("vc-bot-client-auth-box-token-login-");

export const authBoxModule = findCssClassesLazy("authBox", "authBoxExpanded", "block");

export const inputModule = findByPropsLazy("inputWrapper", "inputDefault", "inputError");

export const contentModule = findCssClassesLazy(
    "button",
    "lookFilled",
    "colorBrand",
    "sizeLarge",
    "fullWidth",
    "grow",
    "contents",
);

export const tokenLabels: Record<AccountMode, { title: string; placeholder: string; }> = {
    bot: { title: "Token du bot", placeholder: "Colle le token de ton bot" },
    user: { title: "Token du compte", placeholder: "Colle le token de ton compte Discord" },
    "user-login": { title: "Token du compte", placeholder: "Colle le token de ton compte Discord" },
};

function CredentialLoginModeSelect() {
    return (
        <div className={classes(authBoxModule.block, Margins.top20)}>
            <AccountTypeSelect value={startupAccountMode} onChange={switchLoginMode} />
        </div>
    );
}

export default function AuthBoxTokenLogin() {
    return isCredentialLoginMode ? <CredentialLoginModeSelect /> : <TokenLoginForm />;
}

function TokenLoginForm() {
    const [state, setState] = useState("");
    const [mode, setMode] = useState<AccountMode>(accountModeState.value);
    const [error, setError] = useState<string>();
    const labels = tokenLabels[mode];
    return (
        <>
            <div className={classes(authBoxModule.block, Margins.top20, cl("token-form"))}>
                <div className={Margins.bottom20}>
                    <h5
                        className={classes(cl("h5"), cl("defaultMarginh5"), error && cl("error"))}
                    >
                        {labels.title}
                        {error ? (
                            <span className={cl("errorMessage")}>
                                <span className={cl("errorSeparator")}>-</span>
                                {error}
                            </span>
                        ) : null}
                    </h5>
                    <div className={inputModule.inputWrapper}>
                        <input
                            className={classes(inputModule.inputDefault, error && inputModule.inputError)}
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
                            }}
                        />
                    </div>
                </div>
                <AccountTypeSelect
                    value={mode}
                    onChange={value => {
                        if (value === "user-login") return switchLoginMode(value);
                        accountModeState.value = value;
                        setMode(value);
                        setError(undefined);
                    }}
                />
                <button
                    type="submit"
                    className={classes(Margins.bottom8, contentModule.button, contentModule.lookFilled, contentModule.colorBrand, contentModule.sizeLarge, contentModule.fullWidth, contentModule.grow)}
                    onClick={ev => {
                        ev.preventDefault();
                        if (!RegExToken.test(normalizeToken(state, mode))) {
                            setError("Token invalide");
                            return;
                        }
                        loginWithToken(state, mode);
                    }}
                >
                    <div className={contentModule.contents}>Connexion</div>
                </button>
            </div>
        </>
    );
}
