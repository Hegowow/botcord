import { randomUUID } from "crypto";
import {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    Menu,
    MessageChannelMain,
    Notification,
    NotificationConstructorOptions,
    protocol,
    screen,
    session,
    shell,
    Tray,
} from "electron";
import contextMenu from "electron-context-menu";
import { scope } from "electron-log";
import { autoUpdater } from "electron-updater";
import EventEmitter from "events";
import { existsSync, writeFileSync } from "fs";
import path from "path";

import server from "./APIServer";
import Branding from "./Branding";
import GlobalConfig from "./Config";
import Constants from "./Constants";
import { IPCEvent } from "./IPCEvents";
import { setupIPCEvents } from "./IPCManager";
import { setupMediaPermissions } from "./MediaPermissions";
import messageEditor from "./MessageEditorServer";

export class DiscordBotClient extends EventEmitter {
    logger = scope(Constants.AppName);
    #shouldQuitApp = false;
    win!: BrowserWindow;
    tray!: Tray;
    port!: number;
    customSession?: Electron.Session;
    childWindows = new Map<string, BrowserWindow>();
    editorWindow?: BrowserWindow;
    config = GlobalConfig;
    ipcMain = ipcMain;

    messageEditorPort!: number;

    constructor () {
        super();
        this.logger.log("App starting...");
        this.initApp();
    }
    initTray (menu: Electron.Menu) {
        if (!this.tray) {
            this.tray = new Tray(Constants.icon16);
        }
        this.tray.setToolTip(`${Constants.AppName} v${app.getVersion()}`);
        this.tray.on("click", () => {
            this.win.show();
        });
        this.tray.setContextMenu(menu);
    }
    async clearCacheOnBrandChange () {
        const marker = path.join(app.getPath("userData"), `brand-assets-${Branding.BrandAssetsVersion}`);
        if (existsSync(marker)) return;
        await this.customSession?.clearCache();
        writeFileSync(marker, "");
    }
    setupTray () {
        const menu = Menu.buildFromTemplate([
            {
                label: `${Constants.AppName} v${app.getVersion()}`,
                icon: Constants.icon16,
                enabled: false,
            },
            {
                type: "separator",
            },
            {
                label: "Rechercher des mises à jour…",
                type: "normal",
                click: () => {
                    this.checkingForUpdates(true);
                },
            },
            {
                label: "Dépôt GitHub",
                type: "normal",
                click: () => shell.openExternal(`https://github.com/${Constants.GithubRepo}`),
            },
            {
                type: "separator",
            },
            {
                label: "Reload",
                click: () => {
                    this.win.reload();
                },
            },
            {
                label: "Relaunch",
                click: () => this.relaunch(),
            },
            {
                label: "Settings (Config Editor)",
                click: () => {
                    this.openConfigEditorWindow();
                },
            },
            {
                label: "Delete all application data and relaunch",
                click: async () => {
                    const result = await dialog.showMessageBox(this.win, {
                        type: "warning",
                        buttons: ["Cancel", "Delete and Relaunch"],
                        defaultId: 0,
                        cancelId: 0,
                        title: "Confirm Data Deletion",
                        message: "Are you sure you want to delete all application data?",
                        detail:
                            "The following data will be permanently deleted:\n" +
                            "\n• Discord HTTP request cache" +
                            "\n• Data stored in session cache (cleared by clearCache)" +
                            "\n• Data stored in browser storage (cleared by clearStorageData)" +
                            "\n• Local databases: PrivateChannel, UserSetting, Frequency" +
                            "\n\nAll saved settings and cached data will be lost. This action cannot be undone.",
                    });

                    if (result.response === 1) {
                        try {
                            await this.win.webContents.session.clearCache();
                            await this.win.webContents.session.flushStorageData();
                            await this.win.webContents.session.clearStorageData({
                                storages: [
                                    "cookies",
                                    "filesystem",
                                    "indexdb",
                                    "localstorage",
                                    "shadercache",
                                    "serviceworkers",
                                    "cachestorage",
                                ],
                            });
                            this.relaunch();
                        } catch (err) {
                            console.error("Failed to clear app data:", err);
                        }
                    } else {
                        console.log("User canceled data deletion.");
                    }
                },
            },

            {
                label: "Toggle DevTools",
                click: () => {
                    this.win.webContents.toggleDevTools();
                },
            },
            {
                type: "separator",
            },
            {
                label: "Quit",
                click: () => this.quit(),
            },
        ]);
        this.initTray(menu);
    }
    async initApp () {
        this.port = await server();
        this.messageEditorPort = await messageEditor();
        app.setAppUserModelId(Constants.AppID);
        const enabledFeatures = new Set(app.commandLine.getSwitchValue("enable-features").split(","));
        const disabledFeatures = new Set(app.commandLine.getSwitchValue("disable-features").split(","));
        app.commandLine.appendSwitch("allow-insecure-localhost", "true");
        app.commandLine.appendSwitch("ignore-certificate-errors");
        app.commandLine.appendSwitch("host-rules", `MAP ${Constants.CustomDiscordDomain} 127.0.0.1:${this.port}`);
        app.commandLine.appendSwitch("disable-renderer-backgrounding");
        app.commandLine.appendSwitch("disable-background-timer-throttling");
        app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
        app.commandLine.appendSwitch("no-proxy-server");
        Constants.enableFeatures.forEach(feature => {
            enabledFeatures.add(feature);
        });
        Constants.disableFeatures.forEach(feature => {
            disabledFeatures.add(feature);
        });
        const enabledFeaturesArray = Array.from(enabledFeatures).filter(Boolean);
        const disabledFeaturesArray = Array.from(disabledFeatures).filter(Boolean);
        if (enabledFeaturesArray.length) {
            app.commandLine.appendSwitch("enable-features", enabledFeaturesArray.join(","));
            this.logger.log("Enabled Chromium features:", enabledFeaturesArray.join(", "));
        }

        if (disabledFeaturesArray.length) {
            app.commandLine.appendSwitch("disable-features", disabledFeaturesArray.join(","));
            this.logger.log("Disabled Chromium features:", disabledFeaturesArray.join(", "));
        }
        app.on("window-all-closed", () => {
            if (process.platform !== "darwin") this.quit();
        });

        app.on("before-quit", event => {
            this.#shouldQuitApp = true;
            this.logger.info("App closing...");
            this.logger.info("=".repeat(50));
        });

        app.on("second-instance", (event, commandLine, workingDirectory, additionalData) => {
            const myWindow = BrowserWindow.getAllWindows()?.[0];
            if (myWindow) {
                myWindow.show();
            }
        });

        app.userAgentFallback = app.userAgentFallback.replace(/Electron\/[\d.]+/, "");

        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
            this.logger.debug("Second Instance detected. Quit app...");
            this.#shouldQuitApp = true;
            app.quit();
        } else {
            protocol.registerSchemesAsPrivileged([
                {
                    scheme: "https",
                    privileges: {
                        standard: true,
                        bypassCSP: true,
                        allowServiceWorkers: true,
                        supportFetchAPI: true,
                        corsEnabled: true,
                        stream: true,
                    },
                },
            ]);
            app.whenReady().then(async () => {
                this.logger.info("Creating session...");
                this.customSession = session.fromPartition(`persist:${Branding.SystemUserName}_${Branding.GithubRepoName}`);
                await this.clearCacheOnBrandChange();
                app.configureHostResolver({
                    enableBuiltInResolver: true,
                    secureDnsMode: "secure",
                    enableHappyEyeballs: true,
                    enableAdditionalDnsQueryTypes: true,
                    secureDnsServers: ["https://cloudflare-dns.com/dns-query"],
                });
                this.checkingForUpdates(false);
                this.createWindow();
                app.on("activate", () => {
                    if (BrowserWindow.getAllWindows().length === 0) {
                        this.createWindow();
                    } else {
                        this.win?.show();
                    }
                });
            });
        }

        contextMenu({
            showLearnSpelling: false,
            showSearchWithGoogle: false,
            showCopyImageAddress: true,
            showInspectElement: true,
            showSaveImage: true,
            showSaveImageAs: true,
            showSaveVideo: true,
            showSaveVideoAs: true,
        });

        setupIPCEvents(this);
    }
    get session () {
        if (this.customSession) {
            return this.customSession;
        } else {
            return session.defaultSession;
        }
    }
    async sessionPatch () {
        this.session.webRequest.onBeforeRequest(
            {
                urls: ["https://*.stripe.com/*"],
            },
            (details, callback) => {
                callback({
                    cancel: true,
                });
            },
        );
        this.session.webRequest.onHeadersReceived(
            {
                urls: ["https://raw.githubusercontent.com/*"],
                types: ["stylesheet"],
            },
            (details, callback) => {
                if (!details.responseHeaders) {
                    return callback({ responseHeaders: details.responseHeaders });
                }
                const url = new URL(details.url);
                if (url.pathname.endsWith(".css")) {
                    details.responseHeaders["content-type"] = ["text/css"];
                }
                callback({ responseHeaders: details.responseHeaders });
            },
        );
        const extension = await this.session.extensions.loadExtension(Constants.VencordExtensionPath);
        this.logger.info(`Loaded Vencord Extension v${extension.version} from ${Constants.VencordExtensionPath}`);
    }
    async createWindow () {
        this.setupTray();
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        this.win = new BrowserWindow({
            width: Math.floor(width * 0.9),
            height: Math.floor(height * 0.9),
            minWidth: 940,
            minHeight: 500,
            icon: Constants.icon128,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "ElectronPreload.js"),
                session: this.session,
            },
            backgroundColor: "#36393f",
            titleBarStyle: "hidden",
            frame: false,
            title: Constants.AppName,
            trafficLightPosition: { x: 10, y: 10 },
        });
        this.win.on("close", event => {
            if (!this.#shouldQuitApp) {
                event.preventDefault();
                this.win.hide();
            }
        });
        this.win.on("focus", () => {
            this.win.flashFrame(false);
        });

        await this.sessionPatch();

        this.logger.info(`Electron UserData: ${app.getPath("userData")}`);
        setupMediaPermissions(this.session, () => this.win);
        if (!app.isPackaged) this.win.webContents.openDevTools();
        this.win.webContents.setWindowOpenHandler(({ url }) => {
            this.logger.log("WindowOpenHandler", url);
            switch (url) {
                case "about:blank":
                    return {
                        action: "allow",
                        overrideBrowserWindowOptions: {
                            icon: Constants.icon128,
                            frame: true,
                            autoHideMenuBar: true,
                            width: 1080,
                            height: 720,
                            webPreferences: {
                                webSecurity: false,
                            },
                        },
                    };
                case "https://discord.com/popout":
                case "https://ptb.discord.com/popout":
                case "https://canary.discord.com/popout":
                case `https://localhost:${this.port}/popout`:
                    return {
                        action: "allow",
                        overrideBrowserWindowOptions: {
                            icon: Constants.icon128,
                            frame: true,
                            autoHideMenuBar: true,
                            width: 1080,
                            height: 720,
                            webPreferences: {
                                webSecurity: false,
                            },
                        },
                    };
            }

            if (
                [
                    "https://checkout.paypal.com/web",
                    "https://discord.com/connections",
                    "https://ptb.discord.com/connections",
                    "https://canary.discord.com/connections",
                    `https://localhost:${this.port}/connections`,
                ].some(e => url.includes(e))
            ) {
                return { action: "deny" };
            }

            let protocolHandle: string;

            try {
                protocolHandle = new URL(url).protocol;
            } catch {
                return { action: "deny" };
            }

            switch (protocolHandle) {
                case "http:":
                case "https:":
                case "mailto:":
                case "steam:":
                case "spotify:":
                    shell.openExternal(url);
            }

            return { action: "deny" };
        });
        this.win.webContents
            .on("did-create-window", (window, details) => {
                window.show();
                window.on("closed", () => {
                    this.childWindows.delete(details.frameName);
                });
                this.childWindows.get(details.frameName)?.close();
                this.childWindows.set(details.frameName, window);
            })
            .on("did-start-loading", () => {
                this.win.setProgressBar(2, { mode: "indeterminate" });
            })
            .on("did-stop-loading", () => {
                this.win.setTitle(Constants.AppName);
                this.win.setProgressBar(-1);
            });

        this.win.loadURL(`https://${Constants.CustomDiscordDomain}`);
    }
    showNotification (options: NotificationConstructorOptions, callback?: () => unknown) {
        const notif = new Notification(options);
        function handleClick () {
            notif.close();
            if (callback && typeof callback === "function") callback();
        }
        if (callback && typeof callback === "function") notif.once("click", handleClick);
        setTimeout(() => {
            notif.close();
            notif.removeListener("click", handleClick);
        }, 15000).unref();
        notif.show();
    }
    showUpdateDialog (options: Electron.MessageBoxOptions) {
        const parent = this.win && !this.win.isDestroyed() && this.win.isVisible() ? this.win : null;
        return parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options);
    }
    checkingForUpdates (forceEmitted = false) {
        if (!app.isPackaged) {
            if (forceEmitted) {
                this.showNotification({
                    title: "Update Manager",
                    body: "Les mises à jour automatiques sont désactivées en mode développement.",
                    silent: false,
                });
            }
            return Promise.resolve(false);
        }

        autoUpdater.logger = scope("AutoUpdater");
        autoUpdater.disableWebInstaller = true;

        autoUpdater.autoDownload = true;

        autoUpdater.removeAllListeners();

        return new Promise(resolve => {
            autoUpdater.on("update-available", info => {
                const releaseUrl = `https://github.com/${Constants.GithubRepo}/releases/tag/v${info.version}`;

                this.showNotification(
                    {
                        title: "Mise à jour disponible",
                        body: `KahoCord ${info.version} est en cours de téléchargement.`,
                        silent: false,
                    },
                    () => {
                        shell.openExternal(releaseUrl);
                    },
                );
            });

            autoUpdater.on("update-not-available", () => {
                if (forceEmitted) {
                    this.showUpdateDialog({
                        type: "info",
                        title: "Mises à jour",
                        message: "KahoCord est à jour",
                        detail: `Tu utilises la dernière version (${app.getVersion()}).`,
                        buttons: ["OK"],
                    });
                }
                resolve(true);
            });

            autoUpdater.on("error", err => {
                this.logger.error("Error in auto-updater: " + err);
                if (forceEmitted) {
                    this
                        .showUpdateDialog({
                            type: "warning",
                            title: "Mises à jour",
                            message: "Impossible de vérifier les mises à jour",
                            detail: err.message,
                            buttons: ["Voir les versions", "Fermer"],
                            defaultId: 0,
                            cancelId: 1,
                        })
                        .then(({ response }) => {
                            if (response === 0) shell.openExternal(`https://github.com/${Constants.GithubRepo}/releases`);
                        });
                }
                resolve(false);
            });

            autoUpdater.on("download-progress", progressObj => {
                const percent = Math.round(progressObj.percent);
                this.logger.debug(`Downloaded ${percent}%`);
                if (this.tray && !this.tray.isDestroyed()) {
                    this.tray.setToolTip(`${Constants.AppName} v${app.getVersion()} - Téléchargement : ${percent} %`);
                }
            });

            autoUpdater.on("update-downloaded", info => {
                if (this.tray && !this.tray.isDestroyed()) {
                    this.tray.setToolTip(`${Constants.AppName} v${app.getVersion()}`);
                }

                this
                    .showUpdateDialog({
                        type: "info",
                        title: "Mise à jour prête",
                        message: `KahoCord ${info.version} est prêt à être installé`,
                        detail: "Redémarre l'application pour appliquer la mise à jour.",
                        buttons: ["Redémarrer", "Plus tard"],
                        defaultId: 0,
                        cancelId: 1,
                    })
                    .then(returnValue => {
                        if (returnValue.response === 0) autoUpdater.quitAndInstall(true, true);
                    });
                resolve(true);
            });

            autoUpdater.checkForUpdates();
        });
    }
    relaunch () {
        this.#shouldQuitApp = true;
        app.relaunch();
        app.quit();
    }
    quit () {
        this.#shouldQuitApp = true;
        app.quit();
    }
    openConfigEditorWindow () {
        if (this.editorWindow && !this.editorWindow.isDestroyed()) {
            this.editorWindow.show();
            return;
        }
        this.editorWindow = new BrowserWindow({
            width: 1080,
            height: 720,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "ConfigEditorPreload.js"),
            },
            icon: Constants.icon128,
            frame: true,
            autoHideMenuBar: true,
        });
        this.editorWindow.loadFile(Constants.ConfigEditorHTMLPath);
        this.editorWindow.on("closed", () => {
            this.editorWindow = undefined;
        });
    }

    openDiscordMessageEditorWindow () {
        const editorWindow = new BrowserWindow({
            width: 1080,
            height: 720,
            minWidth: 800,
            minHeight: 600,
            parent: this.win,
            modal: true,
            webPreferences: {
                webSecurity: false,
                sandbox: false,
                preload: path.join(__dirname, "MessageEditorPreload.js"),
                partition: "temp:" + randomUUID(),
            },
            icon: Constants.icon128,
            frame: true,
            autoHideMenuBar: true,
        });
        editorWindow.loadURL(`http://localhost:${this.messageEditorPort}`);
        editorWindow.webContents.ipc.once(IPCEvent.MessageEditorReactReady, () => {
            this.logger.debug("Message Editor is ready. Setting up MessageChannel...");
            const { port1, port2 } = new MessageChannelMain();
            editorWindow.webContents.postMessage(IPCEvent.MessageEditorReceivePort, null, [port2]);
            this.win.webContents.postMessage(IPCEvent.MainAppReceiveEditorPort, null, [port1]);
        });
    }

    get app () {
        return app;
    }
}
