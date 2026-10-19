import { BrowserWindow, desktopCapturer, dialog, Session, systemPreferences } from "electron";

import AccountMode from "./AccountMode";

const maxPickerSources = 12;

async function askMacMediaAccess (mediaTypes: string[]) {
    if (process.platform !== "darwin") return true;
    let granted = true;
    if (mediaTypes.includes("audio")) granted &&= await systemPreferences.askForMediaAccess("microphone");
    if (mediaTypes.includes("video")) granted &&= await systemPreferences.askForMediaAccess("camera");
    return granted;
}

async function pickCaptureSource (window: BrowserWindow) {
    const sources = await desktopCapturer.getSources({ types: ["screen", "window"], fetchWindowIcons: false });
    if (!sources.length) return null;
    if (sources.length === 1) return sources[0];
    const choices = sources.slice(0, maxPickerSources);
    const { response } = await dialog.showMessageBox(window, {
        type: "question",
        title: "Partage d'écran",
        message: "Que veux-tu partager ?",
        buttons: [...choices.map(source => source.name || source.id), "Annuler"],
        cancelId: choices.length,
        defaultId: 0,
    });
    return choices[response] ?? null;
}

export function setupMediaPermissions (session: Session, getWindow: () => BrowserWindow) {
    session.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
        if (permission !== "media") return callback(true);
        const mediaTypes: string[] = "mediaTypes" in details ? details.mediaTypes ?? [] : [];
        if (mediaTypes.includes("video") && !AccountMode.isUser) return callback(false);
        callback(await askMacMediaAccess(mediaTypes));
    });

    session.setDisplayMediaRequestHandler(
        async (request, callback) => {
            if (!AccountMode.isUser) return callback({});
            try {
                const source = await pickCaptureSource(getWindow());
                if (!source) return callback({});
                callback({
                    video: source,
                    ...(request.audioRequested && process.platform === "win32" ? { audio: "loopback" as const } : {}),
                });
            } catch {
                callback({});
            }
        },
        { useSystemPicker: true },
    );
}
