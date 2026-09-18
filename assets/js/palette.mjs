/**
 * Initialize the command palette
 * @param {Kernel} kernel 
 * @param {LiDesktop} desktop 
 * @param {LoggerContext} LoggerContext 
 */
function init(kernel, desktop, LoggerContext) {
    const topBar = LS.SelectOne("#topOverlay");

    topBar.innerHTML = `<div id="commandTerminal" class="level-n3" style="display: none"><div class="terminal-output"></div></div>
<div class="ls-command-palette-wrapper level-n3">
    <div class="ls-command-palette"></div>
    <div class="ls-command-palette-buttons">
        <button ls-tooltip="Close" class="square clear" aria-label="Close command palette"><i class="bi-x-lg"></i></button>
    </div>
</div>`;

    const paletteBar = LS.SelectOne(".ls-command-palette-wrapper");
    const terminalContainer = LS.SelectOne("#commandTerminal");

    const paletteContainer = LS.SelectOne(".ls-command-palette");

    const terminalOutput = terminalContainer.querySelector(".terminal-output");
    const log = {
        info : (...a) => LS.CommandPalette.writeLogTo(terminalOutput, 0, ...a),
        log  : (...a) => LS.CommandPalette.writeLogTo(terminalOutput, 1, ...a),
        warn : (...a) => LS.CommandPalette.writeLogTo(terminalOutput, 2, ...a),
        error: (...a) => LS.CommandPalette.writeLogTo(terminalOutput, 3, ...a),
        fatal: (...a) => LS.CommandPalette.writeLogTo(terminalOutput, 4, ...a),
    }

    kernel.terminalWriter = log;

    desktop.commandPalette = new LS.CommandPalette({
        container: paletteContainer,
        fontWidth: 9.6 * 1.2,

        onClose(){ LS.Animation.fadeOut(topBar, 300, "down") },
        onOpen (){ LS.Animation.fadeIn(topBar, 300, "up")    },

        // Scoped logs from the palette
        logger: new LoggerContext("Command Palette", log)
    });

    let terminalHidden = true;
    const terminalObserver = new MutationObserver(() => {
        const hasContent = terminalOutput.children.length > 0;
        if (hasContent) {
            if (terminalHidden) {
                LS.Animation.fadeIn(terminalContainer, 200, "up");
                terminalHidden = false;
            }
        } else {
            if (!terminalHidden) {
                LS.Animation.fadeOut(terminalContainer, 200, "down");
                terminalHidden = true;
            }
        }
    });

    terminalObserver.observe(terminalOutput, { childList: true });

    paletteBar.querySelector("button").onclick = () => {
        desktop.commandPalette.close();
    };

    /**
     * This should later be inline, so we don't waste client memory & cpu. 
     * That's when we use Glitter<3
     */

    /*comptime*/ const kVersionMeta = {
        1: {
            codename: "Zen",
            color: "#B5FFEE"
        },
        2: {
            codename: "Aether",
            color: "#FFA680"
        },
        3: {
            codename: "Forge",
            color: "#8C80FF"
        }
    }

    const major = LS.Util.fast.sliceUntil(kernel.version, ".");

    /*comptime*/ const ckMeta = kVersionMeta[major] || { codename: "Unknown", color: "var(--accent)" };

    desktop.commandPalette.register([
        {
            name: "fetch",
            alias: ["kernel-info", "kernel-version", "version"],
            icon: 'bi-pc-display-horizontal',
            description: "Information about system & environment",
            async onCalled() {
                terminalOutput.appendChild(LS.Create({
                    innerHTML: `<img src="/~/assets/image/kernel-icons/${major}x.png" width="180" style="position:absolute;top:20px;pointer-events:none"><svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180" fill="none">
<rect x="59" y="63" width="82" height="28.9828" fill="black"/>
<rect x="59" y="91.9828" width="82" height="24.7414" fill="${ckMeta.color}"/>
<text fill="black" style="white-space: pre" xml:space="preserve" font-family="JetBrains Mono" font-size="16.9655" font-weight="300" letter-spacing="0em"><tspan x="70.0855" y="110.504">v${LS.Util.fast.sliceUntil(kernel.version, "-")}</tspan></text>
<text fill="${ckMeta.color}" style="white-space: pre" xml:space="preserve" font-family="JetBrains Mono" font-size="22.6207" font-weight="500" letter-spacing="0em"><tspan x="66.0693" y="86.1434">[${ckMeta.codename}]</tspan></text>
</svg>`,
                    style: 'margin:auto;display:flex;justify-content:center;position:relative',

                    effectsVersion: 1,
                    effects: "spring:x,push",
                }));

                const uname = await kernel.env.proc.uname();
                const rootMount = kernel?.fileSystem?.lsmount?.()?.at(-1)?.[1];

                const t = (kernel?.fileSystem?.constructor?.toHuman) || (v=>v);

                log.log(
                    `%clstv.space%c kernel`,
                    "color:var(--accent);font-weight:bold;font-size:1.2em",
                    "color:inherit;font-weight:bold;font-size:1.2em"
                );
                log.log(
                    `%cKernel:%c ${uname.sysname} ${uname.release} (${ckMeta.codename})`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                log.log(
                    `%cLS version:%c ${LS.version}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                if(rootMount) {
                    log.log(
                        `%cDisk (/):%c ${t(rootMount.used, 1)} / ${t(rootMount.size)} (${Math.round((rootMount.used || -1) / (rootMount.size || 1) * 100)}%) - ${rootMount.type || "Unknown"}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                }
                if(app.desktop) {
                    log.log(
                        `%cDesktop:%c ${app.desktop.name || "Unknown"} ${app.desktop.version}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    // terminalWriter.log(
                    //     `%cWindow Manager:%c LS.WindowManager`, // well hm
                    //     "color:var(--accent);font-weight:bold", "color:inherit"
                    // );
                    log.log(
                        `%cWindows:%c ${app.desktop.windowManager.windows.size}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                }
                log.log(
                    `%cViewports:%c ${kernel.viewports.size}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                log.log(
                    `%cPages:%c ${kernel.pageCache.size} / 20`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                log.log(
                    `%cThreads:%c ${kernel.threads.size + 1} / ${kernel.MAX_THREADS}`, // +1 for main thread
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                log.log(
                    `%cSigned in:%c ${await kernel.auth.isLoggedIn() ? "Yes" : "No"}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                log.log(
                    `%cLoadtime:%c ${Math.round(kernel.ttl)}ms (${Math.round(kernel.ttl_scripting)}ms without network)`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
                const uptimeMs = Date.now() - window.__loadTime;
                const uptimeSec = Math.floor(uptimeMs / 1000);
                const hours = Math.floor(uptimeSec / 3600);
                const minutes = Math.floor((uptimeSec % 3600) / 60);
                const seconds = uptimeSec % 60;
                const prettyUptime =
                    (hours > 0 ? hours + "h " : "") +
                    (minutes > 0 ? minutes + "m " : "") +
                    seconds + "s";
                log.log(
                    `%cUptime:%c ${prettyUptime}`,
                    "color:var(--accent);font-weight:bold", "color:inherit"
                );
            }
        },

        {
            name: "settings",
            alias: ["config", "configure", "options"],
            icon: "bi-gear",
            description: "Configuration",
            children: [
                {
                    name: "open",
                    icon: "bi-sliders",
                    description: "Open settings UI"
                },

                {
                    name: "notifications",
                    icon: "bi-bell",
                    description: "Enable or disable notifications",
                    children: [
                        {
                            name: "enable",
                            icon: "bi-bell-fill"
                        },
                        {
                            name: "disable",
                            icon: "bi-bell-slash"
                        }
                    ]
                },

                {
                    name: "privacy",
                    icon: "bi-shield-lock",
                    description: "Privacy settings",
                    children: [
                        {
                            name: "statistics",
                            icon: "bi-bar-chart",
                            description: "Toggle anonymous statistics sharing",
                            onCalled(enabled) {
                                localStorage.setItem("DISABLE_STATS", !enabled);
                                log.log("Statistics sharing " + (enabled ? "enabled - Thank you!" : "disabled - No statistics data will be sent from this browser from now on."));

                                if(!enabled) {
                                    log.warn("Warning: This setting is not saved to your account and is specific to this browser. Make sure to update this setting on other devices.");
                                }
                            },
                            inputs: [
                                {
                                    name: "enabled",
                                    type: "boolean",
                                    default: true
                                }
                            ]
                        }
                    ]
                },

                {
                    name: "performance-mode",
                    icon: "bi-speedometer",
                    description: "Set performance mode",

                    onCalled(value) {
                        window.LOW_PERFORMANCE_MODE = value === "low";
                        localStorage.setItem("LOW_PERFORMANCE_MODE", window.LOW_PERFORMANCE_MODE);
                        log.log("Warning: It is recommended to reload the page for this setting to take effect");
                    },

                    inputs: [ {
                        name: "mode",
                        type: "list",
                        list: [
                            { name: "Normal", description: "Recommended", value: "normal" },
                            { name: "Low", description: "Disables some visual effects", value: "low" },
                        ]
                    } ]
                },

                {
                    name: "desktop.config",
                    icon: "bi-pencil-square",
                    description: "Edit desktop config.conf"
                },
            ]
        },

        {
            name: "lock",
            icon: "bi-lock",
            description: "Lock the desktop",

            onCalled() {
                desktop.lock();
            }
        },

        {
            name: "set-accent",
            icon: "bi-palette2",
            description: "Set an accent color",

            onCalled(color) {
                LS.Color.setAccent(color);
            },

            inputs: [
                { name: "preset", type: "list", list: [
                    { name: "custom", icon: "bi-palette2", type: "color" },

                    { name: "random", icon: "bi-shuffle", onCalled() {
                        LS.Color.setAccent(LS.Color.random());
                    }},

                    ...app.ACCENT_COLORS.map(accent => ({
                        name: accent,
                        icon: `bi-circle-fill`,
                        accentColor: accent,
                        value: accent
                    })
                )] }
            ]
        },

        {
            name: "set-theme",
            icon: "bi-palette",
            description: "Set user theme",
            onCalled(theme) {
                if (theme === "system") {
                    localStorage.removeItem("ls-theme"); LS.Color.setAdaptiveTheme();
                } else {
                    app.theme = theme;
                }
            },
            inputs: [
                {
                    name: "theme",
                    type: "list",
                    list: [
                        { name: "Light", value: "light", icon: "bi-brightness-high" },
                        { name: "Dark", value: "dark", icon: "bi-moon" },
                        { name: "System", value: "system", icon: "bi-laptop" }
                    ]
                }
            ]
        },

        {
            name: "toolbar",
            icon: "bi-tools",
            description: "Toolbars",
            onCalled(toolbar) {
                desktop.openToolbar(toolbar);
                desktop.commandPalette.close();
            },

            inputs: [
                {
                    name: "toolbar",
                    type: "list",
                    list: [
                        { name: "Accounts", value: "login", icon: "bi-person-circle" },
                        { name: "Apps", value: "apps", icon: "bi-app" },
                        { name: "Music Player", value: "musicPlayer", icon: "bi-music-note" },
                        { name: "Customize website", value: "theme", icon: "bi-brush" },
                        { name: "Assistant", value: "assistant", icon: "bi-robot" }
                    ]
                }
            ]
        },

        {
            name: "apps",
            icon: "bi-window",
            description: "Applications",

            children: [
                {
                    name: "open",
                    icon: "bi-box-arrow-up-right",
                    description: "Open an app",
                    children() {
                        return [...kernel.appManifests.values()].map(app => ({ name: app.name.replace(/\s+/g, '_'), value: app.id, icon: app.icon, onCalled() {
                            kernel.openApplication(app, { source: "palette" })
                                // .loading(() => {}) // TODO: loading mark for the palette
                                .done((instance) => {
                                    instance.open?.();
                                    desktop.commandPalette.close();
                                })
                                .catch(error => {
                                    log.log("Failed to open app: " + (error.message || error.error || "Unknown error"));
                                });
                        }}));
                    }
                },

                {
                    name: "uninstall",
                    icon: "bi-trash",
                    description: "Uninstall an app",
                },

                {
                    name: "install",
                    icon: "bi-download",
                    description: "Install an app",
                },

                {
                    name: "sync",
                    icon: "bi-arrow-repeat",
                    description: "Enable sync for an app",
                },

                {
                    name: "unsync",
                    icon: "bi-x-lg",
                    description: "Disable sync for an app",
                },

                {
                    name: "auth",
                    icon: "bi-shield-lock",
                    description: "Authenticate"
                },

                {
                    name: "manage-permissions",
                    icon: "bi-shield-lock",
                    description: "Manage app permissions",
                }
            ]
        },

        {
            name: "echo",
            alias: ["print"],
            icon: "bi-chat",
            description: "Echo input",
            onCalled(text) { log.log(text || "") },
            inputs: [
                { name: "text", type: "string", description: "Text to echo" }
            ]
        },

        {
            name: "version-info",
            icon: "bi-info-circle",
            description: "Get copyable version information",
            async onCalled() {
                const uname = await kernel.env.proc.uname();
                log.log(`${uname.sysname} ${uname.release} LS:${LS.version} DE:${app.desktop?.name} (${ckMeta.codename})`);
            }
        },

        {
            name: "read",
            icon: "bi-book",
            description: "Read a file",
            onCalled(path) {
                if(!path) {
                    log.error("No path provided");
                    return;
                }

                kernel.fileSystem.readFile(path, "utf8")
                    .then(content => {
                        log.log(content);
                    })
                    .catch(err => {
                        let error = err.message || err;
                        log.error(`Failed to read ${path}: ${error}`);
                    });
            },
            inputs: [
                { name: "path", type: "path", description: "Path to the file" }
            ]
        },

        {
            name: "write",
            icon: "bi-pencil",
            description: "Write to a file",
            onCalled(path, content) {
                if(!path) {
                    log.error("No path provided");
                    return;
                }

                kernel.fileSystem.writeFile(path, content)
                    .then(() => {
                        log.log(`Successfully wrote to ${path}`);
                    })
                    .catch(err => {
                        let error = err.message || err;
                        log.error(`Failed to write to ${path}: ${error}`);
                    });
            },
            inputs: [
                { name: "path", type: "path", description: "Path to the file" },
                { name: "content", type: "string", description: "Content to write" }
            ]
        },

        // {
        //     name: "lm",
        //     alias: ["assistant"],
        //     icon: "bi-robot",
        //     description: "Assistant",
        //     onCalled(text) { terminalWriter.log(text || "") },
        //     inputs: [{ name: "text", type: "string", description: "Text" }]
        // },

        {
            name: "clear",
            icon: "bi-trash",
            alias: ["clear-terminal", "cls"],
            description: "Clear the terminal output",
            onCalled() { terminalOutput.replaceChildren(); }
        },

        {
            name: "close",
            alias: ["exit"],
            icon: "bi-x-circle",
            description: "Close the command palette",
            onCalled() { desktop.commandPalette.close() }
        },

        {
            name: "logout",
            icon: "bi-box-arrow-right",
            description: "Log out of the desktop",
            onCalled() {
                desktop.logout();
            }
        }
    ]);
}

export { init };