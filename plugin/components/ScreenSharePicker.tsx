import "./ScreenSharePicker.css";

import { FormSwitch } from "@components/FormSwitch";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { Modal, openModal, useState } from "@webpack/common";

const cl = classNameFactory("vc-kc-screen-picker-");

export interface CaptureSource {
    id: string;
    name: string;
    isScreen: boolean;
    thumbnail: string | null;
    icon: string | null;
}

type Tab = "windows" | "screens";

function SourceCard({ source, selected, onSelect, onConfirm }: { source: CaptureSource; selected: boolean; onSelect(): void; onConfirm(): void; }) {
    return (
        <button
            type="button"
            className={classes(cl("card"), selected && cl("card-selected"))}
            onClick={onSelect}
            onDoubleClick={onConfirm}
        >
            <div className={cl("preview")}>
                {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <span className={cl("no-preview")}>Aperçu indisponible</span>}
            </div>
            <div className={cl("label")}>
                {source.icon && <img className={cl("icon")} src={source.icon} alt="" />}
                <span className={cl("name")}>{source.name}</span>
            </div>
        </button>
    );
}

function Picker({ modalProps, sources, audioSupported, onDone }: {
    modalProps: { transitionState: number; onClose(): void; };
    sources: CaptureSource[];
    audioSupported: boolean;
    onDone(sourceId: string | null, audio: boolean): void;
}) {
    const windows = sources.filter(source => !source.isScreen);
    const screens = sources.filter(source => source.isScreen);
    const [tab, setTab] = useState<Tab>(windows.length ? "windows" : "screens");
    const [selected, setSelected] = useState<string | null>(null);
    const [audio, setAudio] = useState(true);
    const visible = tab === "windows" ? windows : screens;

    const finish = (sourceId: string | null) => {
        onDone(sourceId, audio);
        modalProps.onClose();
    };

    return (
        <Modal
            {...modalProps}
            title="Partage d'écran"
            size="lg"
            actions={[
                { text: "Passer en direct", variant: "primary", disabled: !selected, onClick: () => finish(selected) },
                { text: "Annuler", variant: "secondary", onClick: () => finish(null) },
            ]}
            actionBarInput={audioSupported ? (
                <FormSwitch title="Partager le son" value={audio} onChange={setAudio} hideBorder className={cl("audio")} />
            ) : undefined}
        >
            <div className={cl("tabs")} role="tablist">
                <button type="button" role="tab" className={classes(cl("tab"), tab === "windows" && cl("tab-active"))} onClick={() => setTab("windows")}>
                    Applications ({windows.length})
                </button>
                <button type="button" role="tab" className={classes(cl("tab"), tab === "screens" && cl("tab-active"))} onClick={() => setTab("screens")}>
                    Écrans ({screens.length})
                </button>
            </div>
            {visible.length ? (
                <div className={cl("grid")}>
                    {visible.map(source => (
                        <SourceCard
                            key={source.id}
                            source={source}
                            selected={selected === source.id}
                            onSelect={() => setSelected(source.id)}
                            onConfirm={() => finish(source.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className={cl("empty")}>
                    Rien à partager ici. Sur macOS, autorise KahoCord dans Réglages Système → Confidentialité et sécurité → Enregistrement de l'écran, puis relance l'app.
                </div>
            )}
        </Modal>
    );
}

export function startScreenSharePicker() {
    window.BotClientNative?.onScreenSharePickRequest?.((requestId: string, sources: CaptureSource[], audioSupported: boolean) => {
        let answered = false;
        const respond = (sourceId: string | null, audio: boolean) => {
            if (answered) return;
            answered = true;
            window.BotClientNative.respondScreenSharePick(requestId, sourceId, audio);
        };
        openModal(
            modalProps => <Picker modalProps={modalProps} sources={sources} audioSupported={audioSupported} onDone={respond} />,
            { onCloseCallback: () => respond(null, false) },
        );
    });
}
