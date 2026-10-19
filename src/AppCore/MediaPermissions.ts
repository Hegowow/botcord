import { randomUUID } from "crypto";
import { BrowserWindow, desktopCapturer, DesktopCapturerSource, dialog, ipcMain, Session, systemPreferences } from "electron";

import AccountMode from "./AccountMode";
import { IPCEvent } from "./IPCEvents";

const maxFallbackSources = 12;
const pickerTimeoutMs = 5 * 60 * 1000;

interface PickerChoice {
    sourceId: string | null;
    audio: boolean;
}

const pendingPicks = new Map<string, (choice: PickerChoice) => void>();
const readyRenderers = new Set<number>();
const trackedRenderers = new Set<number>();

ipcMain.on(IPCEvent.ScreenSharePickerReady, event => {
    const { id } = event.sender;
    readyRenderers.add(id);
    if (trackedRenderers.has(id)) return;
    trackedRenderers.add(id);
    event.sender.on("did-navigate", () => readyRenderers.delete(id));
    event.sender.once("destroyed", () => {
        readyRenderers.delete(id);
        trackedRenderers.delete(id);
    });
});

ipcMain.on(IPCEvent.ScreenSharePickResponse, (_event, requestId: string, sourceId: string | null, audio: boolean) => {
    pendingPicks.get(requestId)?.({ sourceId, audio: audio === true });
    pendingPicks.delete(requestId);
});

async function askMacMediaAccess (mediaTypes: string[]) {
    if (process.platform !== "darwin") return true;
    let granted = true;
    if (mediaTypes.includes("audio")) granted &&= await systemPreferences.askForMediaAccess("microphone");
    if (mediaTypes.includes("video")) granted &&= await systemPreferences.askForMediaAccess("camera");
    return granted;
}

function serializeSource (source: DesktopCapturerSource) {
    return {
        id: source.id,
        name: source.name,
        isScreen: source.id.startsWith("screen:"),
        thumbnail: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
        icon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null,
    };
}

function askRenderer (window: BrowserWindow, sources: DesktopCapturerSource[], audioSupported: boolean) {
    return new Promise<PickerChoice>(resolve => {
        const requestId = randomUUID();
        const timer = setTimeout(() => {
            pendingPicks.delete(requestId);
            resolve({ sourceId: null, audio: false });
        }, pickerTimeoutMs);
        pendingPicks.set(requestId, choice => {
            clearTimeout(timer);
            resolve(choice);
        });
        window.webContents.send(IPCEvent.ScreenSharePickRequest, requestId, sources.map(serializeSource), audioSupported);
    });
}

async function askWithDialog (window: BrowserWindow, sources: DesktopCapturerSource[]): Promise<PickerChoice> {
    const choices = sources.slice(0, maxFallbackSources);
    const { response } = await dialog.showMessageBox(window, {
        type: "question",
        title: "Partage d'écran",
        message: "Que veux-tu partager ?",
        buttons: [...choices.map(source => source.name || source.id), "Annuler"],
        cancelId: choices.length,
        defaultId: 0,
    });
    return { sourceId: choices[response]?.id ?? null, audio: false };
}

export function setupMediaPermissions (session: Session, getWindow: () => BrowserWindow) {
    session.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
        if (permission !== "media") return callback(true);
        const mediaTypes: string[] = "mediaTypes" in details ? details.mediaTypes ?? [] : [];
        if (mediaTypes.includes("video") && !AccountMode.isUser) return callback(false);
        callback(await askMacMediaAccess(mediaTypes));
    });

    session.setDisplayMediaRequestHandler(async (request, callback) => {
        if (!AccountMode.isUser) return callback({});
        try {
            const window = getWindow();
            const sources = await desktopCapturer.getSources({
                types: ["screen", "window"],
                thumbnailSize: { width: 480, height: 270 },
                fetchWindowIcons: true,
            });
            if (!sources.length) return callback({});
            const audioSupported = request.audioRequested && process.platform === "win32";
            const choice = !window.webContents.isDestroyed() && readyRenderers.has(window.webContents.id)
                ? await askRenderer(window, sources, audioSupported)
                : await askWithDialog(window, sources);
            const source = sources.find(candidate => candidate.id === choice.sourceId);
            if (!source) return callback({});
            callback({ video: source, ...(audioSupported && choice.audio ? { audio: "loopback" as const } : {}) });
        } catch {
            callback({});
        }
    });
}
