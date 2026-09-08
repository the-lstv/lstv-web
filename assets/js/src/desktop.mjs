// WARNING: The following imports are just a stub, the actual build system is being worked on.
import { TmpFs, RootFs } from "./fs.mjs";
import { SoundBox } from "./soundbox.mjs";
import { LoggerContext, AssetManager, ContentContext, Viewport, Thread } from "./commons.mjs";
import { app } from "./shared.mjs";
import { kernel } from "./kernel.mjs";

/**
 * Media player class
 */
class MediaPlayer {
    constructor() {
        this.toolbarElement = LS.SelectOrCreate("#musicPlayer");
        this.initialized = false;

        shortcutManager.assign('GLOBAL_OPEN_MUSIC_PLAYER', () => {
            app.desktop.openToolbar("musicPlayer", true);
        });
    }

    create(d){'use strict';var e0=document.createElement("div");e0.setAttribute("class","music-player toolbar-styled");var e1=document.createElement("img");e1.setAttribute("alt","Music cover background");e1.setAttribute("crossorigin","anonymous");e1.setAttribute("class","music-player-cover");e0.appendChild(e1);var e2=document.createElement("img");e2.setAttribute("alt","Music cover art");e2.setAttribute("crossorigin","anonymous");e2.setAttribute("class","music-player-art");e0.appendChild(e2);var e3=document.createElement("div");e3.setAttribute("class","music-player-container");var e4=document.createElement("div");e4.setAttribute("class","music-player-info");var e5=document.createElement("span");e5.setAttribute("class","text-overflow-nowrap music-player-title");var t6=document.createTextNode("Lorem Ipsum");e5.appendChild(t6);e4.appendChild(e5);var e7=document.createElement("span");e7.setAttribute("class","text-overflow-nowrap music-player-artist");var t8=document.createTextNode("Dolor Sit Amet");e7.appendChild(t8);e4.appendChild(e7);e3.appendChild(e4);var e9=document.createElement("div");e9.setAttribute("class","music-player-progress");var e10=document.createElement("div");e10.setAttribute("class","music-player-progress-bar");var e11=document.createElement("div");e11.setAttribute("class","music-player-progress-filled");e10.appendChild(e11);e9.appendChild(e10);e3.appendChild(e9);var e12=document.createElement("div");e12.setAttribute("class","music-player-controls");var e13=document.createElement("button");e13.setAttribute("ls-tooltip","");e13.setAttribute("aria-label","Like");e13.setAttribute("class","circle clear music-player-like");var e14=document.createElement("i");e14.setAttribute("class","bi-hand-thumbs-up");e13.appendChild(e14);e12.appendChild(e13);var e15=document.createElement("button");e15.setAttribute("ls-tooltip","");e15.setAttribute("aria-label","Previous");e15.setAttribute("class","circle clear music-player-prev");var e16=document.createElement("i");e16.setAttribute("class","bi-skip-start-fill");e15.appendChild(e16);e12.appendChild(e15);var e17=document.createElement("button");e17.setAttribute("ls-tooltip","");e17.setAttribute("aria-label","Play/Pause");e17.setAttribute("class","circle clear music-player-play-pause");var e18=document.createElement("i");e18.setAttribute("class","bi-play-fill");e17.appendChild(e18);e12.appendChild(e17);var e19=document.createElement("button");e19.setAttribute("ls-tooltip","");e19.setAttribute("aria-label","Next");e19.setAttribute("class","circle clear music-player-next");var e20=document.createElement("i");e20.setAttribute("class","bi-skip-end-fill");e19.appendChild(e20);e12.appendChild(e19);var e21=document.createElement("button");e21.setAttribute("ls-tooltip","Repeat Off");e21.setAttribute("aria-label","Toggle repeat modes");e21.setAttribute("class","circle clear music-player-repeat");var e22=document.createElement("i");e22.setAttribute("class","bi-arrow-repeat");e21.appendChild(e22);e12.appendChild(e21);e3.appendChild(e12);e0.appendChild(e3);var __rootValue=e0;return{root:__rootValue};}

    init(){
        if(this.initialized) return;
        this.initialized = true;

        this.toolbarElement.appendChild(this.create().root);

        this.audio = new Audio();
        this.titleElement = this.toolbarElement.querySelector(".music-player-title");
        this.artistElement = this.toolbarElement.querySelector(".music-player-artist");
        this.coverElement = this.toolbarElement.querySelector(".music-player-cover");
        this.coverArtElement = this.toolbarElement.querySelector(".music-player-art");

        this.menuContainer = this.toolbarElement.querySelector(".music-menu");

        if(this.menuContainer) {
            let menuOpen = false;
            this.toolbarElement.querySelector(".music-menu-toggle").onclick = () => {
                menuOpen = !menuOpen;
                if(!menuOpen) {
                    LS.Animation.fadeOut(this.menuContainer, 300, "bottom");
                    return;
                }

                LS.Animation.fadeIn(this.menuContainer, 300, "bottom");
            }
        }

        // Panel
        this.musicStatusElement = LS.Create("button#musicButton.pill", {
            tooltip: "Music Player <kbd>Ctrl+M</kbd>",
            attr: { "aria-label": "Open music player" },
            inner: [
                { tag: "i", class: "bi-vinyl-fill" },
                { tag: "span", class: "music-player-status text-overflow-nowrap", inner: "Stopped" }
            ]
        });

        this.musicStatusText = this.musicStatusElement.querySelector(".music-player-status");

        this.playButtonElement = this.toolbarElement.querySelector(".music-player-play-pause");
        this.playButtonElement.onclick = () => {
            this.playToggle();
        };

        this.repeatMode = "off";
        this.repeatButtonElement = this.toolbarElement.querySelector(".music-player-repeat");
        this.repeatButtonElement.onclick = () => {
            this.toggleRepeatMode();
        };

        this.musicStatusElement.onclick = () => {
            app.desktop.openToolbar("musicPlayer", true);
        };

        this.musicStatusElement.style.display = "none";
        LS.SelectOne(".headerLeftContainer").appendChild(this.musicStatusElement);
    }

    setCover(imageURL = null, coverArtURL = null) {
        if(!this.initialized) this.init();
        this.toolbarElement.removeAttribute("ls-accent");
        this.musicStatusElement.removeAttribute("ls-accent");
        this.coverElement.style.display = "none";
        this.toolbarElement.classList.remove("has-cover");

        if(!imageURL) {
            return;
        }

        this.coverElement.onload = () => {
            this.coverElement.style.display = "block";
            this.coverArtElement.style.display = "block";
            this.toolbarElement.classList.add("has-cover");

            LS.Color.fromImage(this.coverElement).toAccent("music-cover");

            this.toolbarElement.setAttribute("ls-accent", "music-cover");
            this.musicStatusElement.setAttribute("ls-accent", "music-cover");
        }

        this.coverElement.onerror = () => {
            this.coverElement.style.display = "none";
            this.coverArtElement.style.display = "none";
        }

        this.coverElement.src = imageURL;
        this.coverArtElement.src = coverArtURL || imageURL;
    }

    setDetails(details, playImmediately = false) {
        if(!this.initialized) this.init();
        this.currentDetails = {
            title: details.title || "Unknown Title",
            artist: details.artist || "Unknown Artist",
            album: details.album || "",
            cover: details.cover || null,
            source: details.source || null
        }

        this.musicStatusText.textContent = this.titleElement.textContent = this.currentDetails.title;
        this.artistElement.textContent = this.currentDetails.artist;
        this.setCover(this.currentDetails.cover);

        LS.Animation.fadeIn(this.musicStatusElement, 300, "right");
        this.audio.src = this.currentDetails.source;

        app.collapseItems.schedule();
        setTimeout(() => {
            app.collapseItems.schedule();
        }, 10);

        if(playImmediately) {
            this.play();
        }

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentDetails.title,
                artist: this.currentDetails.artist,
                album: this.currentDetails.album,
                artwork: this.currentDetails.artwork || this.currentDetails.cover ? [
                    { src: this.currentDetails.cover, sizes: '96x96', type: 'image/png' },
                    { src: this.currentDetails.cover, sizes: '128x128', type: 'image/png' },
                    { src: this.currentDetails.cover, sizes: '192x192', type: 'image/png' },
                    { src: this.currentDetails.cover, sizes: '256x256', type: 'image/png' },
                    { src: this.currentDetails.cover, sizes: '384x384', type: 'image/png' },
                    { src: this.currentDetails.cover, sizes: '512x512', type: 'image/png' }
                ] : []
            });

            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('stop', () => {
                this.pause();
                this.stopped();
                this.audio.currentTime = 0;
            });
        }
    }

    stopped() {
        if(!this.initialized) this.init();
        this.musicStatusText.textContent = "Stopped";
        this.titleElement.textContent = "No music playing";
        this.artistElement.textContent = "";
        this.setCover(null);
        this.currentDetails = null;
        LS.Animation.fadeOut(this.musicStatusElement, 300, "right");
    }

    playToggle() {
        if(!this.initialized) this.init();
        if(this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        if(!this.initialized) this.init();
        this.audio.play();
        this.playButtonElement.querySelector("i").className = "bi-pause-fill";
    }

    pause() {
        if(!this.initialized) this.init();
        this.audio.pause();
        this.playButtonElement.querySelector("i").className = "bi-play-fill";
    }

    toggleRepeatMode() {
        if(!this.initialized) this.init();
        if(this.repeatMode === "off") {
            this.repeatMode = "one";
            this.repeatButtonElement.classList.add("active");
            this.repeatButtonElement.querySelector("i").className = "bi-repeat-1";
            this.repeatButtonElement.setAttribute("ls-tooltip", LS.Tooltips.set("Repeat One").position(this.repeatButtonElement).container.textContent);
            this.audio.loop = true;
        } else if(this.repeatMode === "one") {
            this.repeatMode = "all";
            this.repeatButtonElement.querySelector("i").className = "bi-arrow-right";
            this.repeatButtonElement.setAttribute("ls-tooltip", LS.Tooltips.set("Repeat All").position(this.repeatButtonElement).container.textContent);
            this.audio.loop = false;
        } else {
            this.repeatMode = "off";
            this.repeatButtonElement.classList.remove("active");
            this.repeatButtonElement.querySelector("i").className = "bi-repeat";
            this.repeatButtonElement.setAttribute("ls-tooltip", LS.Tooltips.set("Repeat Off").position(this.repeatButtonElement).container.textContent);
            this.audio.loop = false;
        }
    }

    destroy() {
        if(this.destroyed) return;
        this.destroyed = true;

        if(this.audio) {
            this.audio.pause();
            this.audio.src = "";
            this.audio = null;
        }

        if(this.toolbarElement) {
            this.toolbarElement.remove();
            this.toolbarElement = null;
        }

        if(this.musicStatusElement) {
            this.musicStatusElement.remove();
            this.musicStatusElement = null;
        }

        this.currentDetails = null;
    }
}


/**
 * Desktop class
 * Represents the virtual desktop environment and its components.
 * It does not manage or access windows or their content (that is done by LS.WindowManager & kernel) or any other system features.
 */
class LiDesktop {
    name = "lide-web";
    version = "1.0.0-alpha";
    codeName = "Based on LiDE 12 Hiroki";

    /**
     * This constructor constitutes starting a new desktop session.
     * @param {*} options Options
     */
    constructor(options) {
        this.windowManager = LS.WindowManager;

        // System sounds
        const base = "/assets/audio/system/sfx/";
        this.soundBox = new SoundBox({
            volume: 0.5,
            sounds: {
                "click":        { src: base + "click.mp3" },
                "notification": { src: base + "notification.mp3" },
                "error":        { src: base + "error.mp3", fallback: ["system:notification"] },
                "success":      { src: base + "success.mp3" },
                "startup":      { src: base + "startup_1.wav" },
                "timer":        { src: base + "timer.mp3", fallback: ["system:notification"] },
            }
        }, null, "system");

        // Enables closing toolbars via esc
        this.ToolbarStackRef = { close() { app.desktop.closeToolbar() } };

        // Initialize music player (for global media controls, and it is also a player on it's own.)
        this.musicPlayer = new MediaPlayer;

        this.isToolbarOpen = false;

        shortcutManager.assign('GLOBAL_DESKTOP_OPEN_MENU', () => {
            app.desktop.openToolbar("menu", true);
        });

        kernel.environment.setEnv("XDG_CURRENT_DESKTOP", this.constructor.name);

        this.#setupAuth();

        // watch for user changes
        kernel.on("user-changed", (isLoggedIn, fragment) => {
            this.loadUserList();
        });
    }

    /**
     * The state of the desktop's panel.
     * @type {Array}
     */
    // Todo: this is user data
    panelState = []

    static panelComponents = new Map([
        ["accounts", { label: "Account", showIcon: false, buttonLabel: { class: "accountsButton", inner: [{ reactive: "user.username ?? 'Log-In'" }, { class: "profile-picture-preview", inner: { tag: "i", class: "bi-person-fill" } }] }, description: "View and edit your profile or log-in", icon: "bi-person-fill", onClick: () => app.desktop.openToolbar("login") }],

        ["apps", { label: "Apps", tooltip: "Applications", description: "View applications", icon: "bi-grid-fill", onClick() { app.desktop.openToolbar("apps", true) } }],

        // ["assistant", { showLabel: false, label: "Assistant", description: "Open Assistant", icon: "bi-stars", onClick() {
        //     website.desktop.openToolbar("assistant", true);
        // } }],

        ["theme", { buttonLabel: { tag: "i", class: "bi-palette-fill" }, label: "Customize", description: "Customize the site appearance", icon: 'bi-' + (LS.Color.theme === "dark" ? "moon-stars" : "sun") + "-fill",
            onClick() {
                app.desktop.openToolbar("theme", true);
            },

            onceInit() {
                // Color customization
                for(let accent of app.ACCENT_COLORS) {
                    LS.SelectOne("#accentButtons").add(LS.Create("button", {
                        class: "square",
                        inner: accent === "white" ? LS.Create("i", { class: "bi-x-circle-fill" }) : null,
                        accent,
                        tooltip: accent === "white" ? "Reset": (accent.charAt(0).toUpperCase() + accent.slice(1)),
                        onclick(){
                            LS.Color.setAccent(accent);
                        }
                    }));

                    LS.SelectOne("#accentButtons").querySelector("input[type=color]").addEventListener("input", function (){
                        LS.Color.setAccent(this.value);
                    });
                }
            }
        }],

        ["commandPalette", { showLabel: false, label: "Command Palette", tooltip: "Command Palette", description: "Open Command Palette", icon: "bi-terminal", onClick() {
            if(!app.hasCapability("command-palette")) {
                LS.Toast.show("Command Palette is not available in this environment.");
                return;
            }

            app.desktop.closeToolbar();
            app.desktop.openPalette();
        }}],

        ["clock", {
            getElement: () => LS.Create(".taskbar-clock{0:00}"),
            name: "Clock",
            description: "See the current time",

            onInit(item) {
                item.__updateInterval = setInterval(invokeAndReturn(() => {
                    const now = new Date();
                    const hours = now.getHours().toString().padStart(2, "0");
                    const minutes = now.getMinutes().toString().padStart(2, "0");
                    const seconds = now.getSeconds().toString().padStart(2, "0");
                    item.element && (item.element.textContent = `${hours}:${minutes}:${seconds}`);
                }), 1000);
            },

            onDestroy(item) {
                clearInterval(item.__updateInterval);
                item.__updateInterval = null;
            }
        }],

        ["taskbar", {
            getElement: () => LS.Create(".taskbar"),
            name: "Taskbar",
            description: "See open applications",
        }],

        ["website-header", {
            getElement: () => LS.Create("a[href=/].homeButton[aria-label=LSTV Homepage]", {
                html: `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="15" fill="none"><path d="M19.1689 12.3682V13.7529H19.1182L18.3242 12.3682H19.1689ZM14.9346 13.7529H2.3457L8.63965 2.81445L14.9346 13.7529ZM19.1689 6.82617V8.48926H16.0996L15.1465 6.82617H19.1689ZM19.1689 1.5625V2.94727H12.9219L12.1279 1.5625H19.1689Z" stroke="currentColor" stroke-width="2.494"/></svg><span class="headerTitle">LSTV${isBeta? " Beta": ""}</span> <span class="headerText"></span>`
            })
        }],

        ["spacer", { getElement: () => LS.Create(".spacer") }]
    ]);

    toolbars = new Map([
        ["statusbar", {
            element: LS.Create({
                id: "statusbar",
                class: "toolbar toolbar-styled",
                inner: LS.Create({
                    inner: [
                        LS.Create()
                    ]
                })
            }),
            name: "Status Bar",
            description: "Status and notifications"
        }],

        ["login", {
            element: LS.SelectOne("#toolbarLogin"),
            name: "Account",
            description: "View and edit your profile or log-in",
            onOpen() {
                app.loginTabs.set(app.isLoggedIn? "account": "default", true);
            }
        }],

        ["apps", {
            element: LS.SelectOne("#toolbarApps"),
            name: "Apps",
            description: "View applications",

            onOpen() {
                if(!app.desktop.applicationMenu.initialized) {
                    app.desktop.applicationMenu.init();
                }
            }
        }],

        ["theme", {
            element: LS.SelectOne("#toolbarTheme"),
            name: "Theme",
            description: "Customize the site appearance",
        }],

        ["musicPlayer", {
            element: LS.SelectOne("#musicPlayer"),
            name: "Music Player",
            description: "Control music playback",

            onOpen() {
                if(!website.desktop.musicPlayer.initialized) website.desktop.musicPlayer.init();
            }
        }],

        // ["assistant", {
        //     element: LS.SelectOne("#toolbarAssistant"),
        //     name: "Assistant",
        //     description: "Open Assistant",
        //     onOpen() {
        //         if(!window.__assistantLoading) {
        //             window._assistantCallback = null;
        //             window.__assistantLoading = true;

        //             setTimeout(async () => {
        //                 M.LoadScript("/~/assets/js/assistant.js" + window.cacheKey, (error) => {
        //                     if(error || typeof window._assistantCallback !== "function") {
        //                         LS.Toast.show("Sorry, assistant failed to load. Please try again later.");
        //                         return;
        //                     }

        //                     window._assistantCallback(website, kernel.auth);
        //                 })
        //             }, 0);
        //         }
        //     }
        // }],

        ["more", {
            element: LS.SelectOne("#toolbarMore"),
            name: "More",
            description: "More options"
        }]
    ])

    openToolbar(name, toggle = false) {
        console.log("Opening toolbar:", name, "Toggle:", toggle);
        if(app.currentToolbar == name && app.isToolbarOpen) {
            if(toggle) app.desktop.closeToolbar();
            return;
        }

        const toolbar = app.desktop.toolbars.get(name);
        if(!toolbar) return;

        const previousToolbar = app.currentToolbar && app.desktop.toolbars.get(app.currentToolbar);
        if(previousToolbar) {
            if(typeof previousToolbar.onClose === "function") previousToolbar.onClose();
            this.eachButtonOfKind(app.currentToolbar, button => button.classList.remove("open"));
        }

        if(typeof toolbar.onOpen === "function") toolbar.onOpen();

        // TODO: this is incredibly ass
        toolbar.element.classList.add("open");
        for(const tb of app.desktop.toolbars.values()) {
            if(tb !== toolbar) tb.element.classList.remove("open");
        }

        if (app.isToolbarOpen) LS.Animation.slideInToggle(toolbar.element, previousToolbar?.element || null);
        if (!app.isToolbarOpen) LS.Animation.fadeIn(toolbar.element, "up");

        app.isToolbarOpen = true;
        app.currentToolbar = name;
        app.quickEmit("toolbar-open", name);
        kernel.viewport.target.classList.add("shade");
        LS.Stack.push(this.ToolbarStackRef);

        this.eachButtonOfKind(app.currentToolbar, button => button.classList.add("open"));

        return toolbar;
    }

    eachButtonOfKind(kind, callback) {
        for(const item of app.desktop.panelState) {
            console.log(kind, item.kind);
            if(item.kind === kind && item.element instanceof HTMLElement) {
                callback(item.element);
            }
        }
    }

    closeToolbar(immediate = false) {
        console.log("Closing toolbar");
        if(!app.isToolbarOpen) return;

        const toolbar = app.desktop.toolbars.get(app.currentToolbar);
        if (immediate) {
            toolbar.element.style.display = "none";
        } else {
            LS.Animation.fadeOut(toolbar.element, "down");
        }

        if(toolbar) {
            if(typeof toolbar.onClose === "function") toolbar.onClose();
            this.eachButtonOfKind(app.currentToolbar, button => button.classList.remove("open"));
            app.currentToolbar = null;
        }

        app.isToolbarOpen = false;
        app.quickEmit("toolbar-close");
        kernel.viewport.target.classList.remove("shade");
        LS.Stack.remove(this.ToolbarStackRef);
    }

    async openPalette() {
        if (app.isEmbedded) return;

        if (!this.commandPalette) {
            if(kernel._initializingPalette) {
                await kernel._initializingPalette;
            } else {
                kernel._initializingPalette = kernel._initializeCommandPalette();
                await kernel._initializingPalette;
                kernel._initializingPalette = null;
            }
        }

        this.commandPalette.open();
    }

    showLoginToolbar(toggle = false) {
        setTimeout(() => {
            if(!toggle && app.isToolbarOpen && app.currentToolbar === "login") return;

            app.desktop.openToolbar("login", toggle);

            if(!app.isLoggedIn) setTimeout(() => {
                LS.SelectOne("#loginPopup")?.querySelector("button,input")?.focus();
            }, 0);
        }, 0);
    }

    initPanel() {
        const moreButton = LS.SelectOrCreate("#moreButton");
        moreButton.addEventListener("click", () => {
            app.desktop.openToolbar("more", true);
        });

        this.frameScheduler = new LS.Util.FrameScheduler(() => {
            // Read widths first to prevent relayouts
            const isTooSmall = window.innerWidth < 100 || window.innerHeight < 200; // Precalc
            if(resizeMessageSwitch.set(isTooSmall)) {
                return;
            }

            this.updatePanelLayout();
        });

        const resizeMessageContainer = LS.SelectOrCreate("resizeMessage");
        const resizeMessageSwitch = new LS.Util.Switch((on) => {
            if(on) {
                resizeMessageContainer.style.display = "flex";
                app.container.style.display = "none";
            } else {
                resizeMessageContainer.style.display = "none";
                app.container.style.display = "flex";
            }
        });

        this.frameScheduler.schedule();

        window.addEventListener("resize", this.__resizeHandler = () => {
            this.frameScheduler.schedule();
        });

        if(window.visualViewport) {
            window.visualViewport.addEventListener("resize", () => {
                this.frameScheduler.schedule();
            });
        }

        app.collapseItems = this.frameScheduler;

        kernel.addExternalEventListener(document, "pointerdown", (event) => {
            if (app.isToolbarOpen && !event.target.closest("#toolbars,.toolbar-button")) app.desktop.closeToolbar();
        }, { passive: true });
    }

    updatePanelLayout() {
        const navPadding = 28 + 5;
        const gap = 10;

        const nav =        LS.SelectOrCreate("#primaryPanel");
        const container =  LS.SelectOrCreate(".headerButtons");
        const menu =       LS.SelectOrCreate("#toolbarMore");
        const moreButton = LS.SelectOrCreate("#moreButton");

        const availableSpace = nav.clientWidth - navPadding - gap - moreButton.clientWidth - (nav.firstElementChild?.clientWidth || 0);
        const moreButtonClientWidth = moreButton.clientWidth;

        // Try to batch appends (god i hate the dom api SO much)
        let frag, menuFrag;

        let takenSpace = 0;
        for(const item of app.desktop.panelState) {
            const component = LiDesktop.panelComponents.get(item.kind);
            if(!component) continue;

            if(!item.element) {
                if(component.getElement) {
                    item.element = component.getElement();
                } else {
                    let assumedWidth = 40 + gap;
                    const icon = component.showIcon === false ? null : { tag: "i", class: component.icon };
                    const buttonLabel = component.buttonLabel || component.label;

                    if(icon) assumedWidth += 16;
                    if(component.label === "Account") assumedWidth += 46;
                    if(component.showLabel) assumedWidth += (buttonLabel ? (typeof buttonLabel === "string" ? 8 * buttonLabel.length : 16) : 16);

                    item.element = LS.Create("button.toolbar-button.pill.elevated[aria-label='" + component.description + "']", {
                        tooltip: component.tooltip || component.label,
                        inner: component.showLabel !== false? [icon, { tag: "span", inner: buttonLabel, class: typeof buttonLabel === "string" ? "label" : "" }]: icon,
                        onclick: component.onClick || null
                    });
                    
                    // Browser layout rendering is an absolutely incompetent piece of crap
                    // so we need to guess the width to avoid the render>wait>read>render hell
                    // Of course this opens up a whole bunch of other possible problems
                    item.cachedWidth = assumedWidth;
                }

                if(!frag) frag = document.createDocumentFragment();

                frag.appendChild(item.element);
                if(typeof component.onceInit === "function" && !component.__initialized) {
                    try {
                        component.onceInit(item);
                        component.__initialized = true;
                    } catch(e) { console.error(e) }
                }

                if(typeof component.onInit === "function") {
                    try {
                        component.onInit(item);
                    } catch(e) { console.error(e) }
                }
            }


            // if(!item.bs) {
            //     item.element.append(LS.Create({ style: "width:"+item.cachedWidth+"px;position:absolute;height:10px;background:red;z-index:10000;bottom:0;left:0" }));
            //     item.bs = true;
            // }

            // item.cachedWidth = (item.element ? item.element.clientWidth : item.cachedWidth || 0) + gap;
        }

        // const accountButtonText = website.panelItems.get("accountsButton")?.element?.textContent;
        // if(accountButtonText) {
        //     takenSpace += 46 + (accountButtonText.length * 8);
        //     // console.log(takenSpace);
        // }

        let hasCollapsedItems = false;
        // for (const item of app.desktop.panelState) {
        //     if(!item.element) continue;
        //     const detached = item.element.classList.contains("detached");

        //     takenSpace += item.cachedWidth;

        //     if(takenSpace > availableSpace) {
        //         hasCollapsedItems = true;
        //         if(detached) continue;
        //         item.element.classList.add("detached");

        //         if(!item.menuElement) {
        //             item.menuElement = LS.Create({
        //                 class: "toolbar-menu-item",
        //                 attributes: { "aria-label": item.description },
        //                 inner: [{ tag: "i", class: item.icon }, { tag: "span", innerText: item.label }],
        //                 onclick: () => {
        //                     if(item.onclick) item.onclick.call(item.element);
        //                 }
        //             })
        //         }

        //         if(!menuFrag) menuFrag = document.createDocumentFragment();
        //         menuFrag.appendChild(item.menuElement);
        //     } else {
        //         if(!detached) continue;
        //         item.element.classList.remove("detached");
        //         if(item.menuElement && item.menuElement.parentElement) {
        //             item.menuElement.parentElement.removeChild(item.menuElement);
        //         }
        //     }
        // }

        // Write operations
        if(frag)     container.replaceChildren(frag);
        if(menuFrag)      menu.replaceChildren(menuFrag);

        moreButton.style.display = (availableSpace + moreButtonClientWidth) < takenSpace ? "inline-flex" : "none";

        // Close the toolbar if no items are collapsed and it's currently open
        if (!hasCollapsedItems && app.isToolbarOpen && app.currentToolbar === "more") {
            app.desktop.closeToolbar();
        }
    }

    destroyPanelComponent(item) {
        const component = LiDesktop.panelComponents.get(item.kind);
        if(component && typeof component.onDestroy === "function") {
            try {
                component.onDestroy(item);
            } catch(e) { console.error(e) }
        }

        if(item.element) {
            item.element.remove();
            item.element = null;
        }
    }

    // todo: move to desktop
    async loadUserList() {
        const accounts = await this.auth.listAccounts();
        app.accounts = accounts && accounts.accounts || [];

        const list = app.desktop.toolbars.get("login").element.querySelector(".accounts-list");
        list.innerHTML = "";

        for (const account of app.accounts) {
            const item = LS.Create("button", { class: 'account-item elevated loading-right', tabindex: 0, inner: [
                app.views.getProfilePictureView(account.pfp, [ 32 ]),
                { tag: "span", class: 'account-username', textContent: account.username }
            ]});

            if(accounts && accounts.activeAccountId === account.id) {
                item.classList.add("active");
            }

            item.onclick = () => {
                item.setAttribute("state", "loading");
                this.auth.switchAccount(account.id).then(() => {
                    this.loadUser().then(() => {
                        item.removeAttribute("state");
                    });
                }).catch(error => {
                    if(error.code === 401) {
                        app.loginTabs.set("login");
                        app.loginTabs.element.querySelector("#username").value = account.username;
                        app.loginTabs.element.querySelector(".error-message").textContent = "Session expired for this account, please log in again.";
                        const p = app.loginTabs.element.querySelector("#password");
                        p.value = "";
                        p.focus();
                        return;
                    }

                    LS.Toast.show("Failed to switch account: " + (error.message || error.error || "Unknown error"), { accent: "red" });
                });
            };

            list.appendChild(item);
        }

        app.events.emit("user-list-updated", [ app.accounts ]);
    }

    // todo: move to desktop
    #setupAuth() {
        LS.SelectOrCreate("#logOutButton").addEventListener("click", function (){
            kernel.auth.logout(() => {
                LS.Toast.show("Logged out successfully.", {
                    timeout: 2000
                });

                app.desktop.closeToolbar();
                kernel.loadUser();
                app.loginTabs.set("default");
            });
        });

        function clearLoginError() {
            const view = app.loginTabs.currentElement();
            if (!view) return;

            const errorMessage = view.querySelector(".error-message");
            if (errorMessage) errorMessage.textContent = "";

            const offendingElement = view.querySelector("input[aria-invalid='true']");
            if (offendingElement) {
                offendingElement.removeAttribute("aria-invalid");
                offendingElement.removeAttribute("ls-accent");
            }
        }

        function displayLoginError(message, offendingElement) {
            if (offendingElement) {
                offendingElement.setAttribute("aria-invalid", "true");
                offendingElement.setAttribute("ls-accent", "red");
            }

            const errorMessage = app.loginTabs.currentElement().querySelector(".error-message");
            if (errorMessage) errorMessage.textContent = message;
        }

        function redirectAfterLogin() {
            const redirect = kernel.queryParams.continue || ((location.pathname.startsWith("/login") || location.pathname.startsWith("/sign-up"))? "/": null);
            if (redirect) {
                location.replace(redirect);
                return;
            }

            // Update user without reloading
            kernel.loadUser().then(() => {
                app.desktop.closeToolbar();
                app.loginTabs.set("default");
            });
        }

        document.forms["loginForm"].addEventListener("submit", (event) => {
            event.preventDefault();
            clearLoginError();
            const username = LS.SelectOne("#username").value;
            const password = LS.SelectOne("#password").value;

            if (!username || !password) {
                displayLoginError("Username and password are required", LS.SelectOne(!username? "#username" : "#password"));
                return;
            }

            this.auth.login(username, password, (error, result) => {
                if (error) {
                    displayLoginError(error.message || error.error || "An error occurred while logging in");
                    return;
                }

                redirectAfterLogin();
            });

            return false;
        });

        document.forms["registerForm"].addEventListener("submit", (event) => {
            event.preventDefault();
            clearLoginError();
            document.forms["registerStep2Form"].querySelector("input").focus();
            app.loginTabs.set('register-step2');

            return false;
        });

        document.forms["registerStep2Form"].addEventListener("submit", (event) => {
            event.preventDefault();
            clearLoginError();
            const email = LS.SelectOne("#regEmail").value;
            const username = LS.SelectOne("#regUsername").value.toLowerCase();
            const password = LS.SelectOne("#regPassword").value;
            const displayName = event.target.querySelector("input[name='displayname']").value;

            if (!email || !username || !password) {
                app.loginTabs.set('register');
                displayLoginError("All fields are required");
                return;
            }

            this.auth.register({ email, username, password, displayname: displayName || null }, (error, result) => {
                if (error) {
                    app.loginTabs.set('register');
                    console.log(error, (error.code === 4 || error.code === 5)? LS.SelectOne("#regEmail"): (error.code === 3 || error.code === 6)? LS.SelectOne("#regUsername"): error.code === 7? LS.SelectOne("#regPassword"): null);
                    
                    displayLoginError(error.message || error.error || "An error occurred while signing up", (error.code === 4 || error.code === 5)? LS.SelectOne("#regEmail"): (error.code === 3 || error.code === 6)? LS.SelectOne("#regUsername"): error.code === 6? LS.SelectOne("#regPassword"): null);
                    return;
                }

                redirectAfterLogin();
            });
  
            return false;
        });

        app.loginTabs.on("changed", (tab, old) => {
            const view = app.loginTabs.currentElement();
            const oldElement = app.loginTabs.tabs.get(old)?.element;

            clearLoginError();

            view.style.transition = (!app.isToolbarOpen || !oldElement)? "none" : "";

            LS.Animation.slideInToggle(view, oldElement);

            setTimeout(() => {
                LS.SelectOne("#toolbarLogin").style.height = view.offsetHeight + "px";
            });
        });

        app.loginTabs.set(location.pathname.startsWith("/login") ? "login" : location.pathname.startsWith("/sign-up") ?  "register" : "default");

        LS.SelectOne("#randomPassword").addEventListener("click", function (){
            const password = app.utils.generateSecurePassword(12);
            LS.SelectOne("#regPassword").value = password;
            LS.SelectOne("#regPassword").dispatchEvent(new Event("input"));
            alert("Your generated password: " + password);
        });

        LS.SelectOne("#randomUsername").addEventListener("click", function (){
            const username = app.utils.generateUsername();
            LS.SelectOne("#regUsername").value = username.toLowerCase();
            LS.SelectOne("#regUsername").dispatchEvent(new Event("input"));
            LS.SelectOne("#displayname").value = username;
        });
    }

    applicationMenu = new class ApplicationMenu extends LS.Context {
        constructor() {
            super("Application Menu");
            this.initialized = false;
        }

        init() {
            if(this.initialized) return;
            this.initialized = true;

            const container = app.desktop.toolbars.get("apps").element;
            this.appListElement = container.querySelector(".app-list");

            kernel.on("application-installed", (manifest) => {
                this.addApplicationEntry(manifest);
            });

            // Load existing apps
            for(const manifest of kernel.appManifests.values()) {
                this.addApplicationEntry(manifest);
            }
        }

        /**
         * Add an application entry to the application menu.
         * @param {*} manifest 
         */
        addApplicationEntry(manifest) {
            const appId = manifest.id;
            if(!appId) return;

            const appButton = LS.Create({
                class: "app-list-item",

                inner: [
                    app.views.getAppIconView(manifest, [64]),
                    LS.Create('span', { class: 'app-name text-overflow-nowrap', textContent: manifest.name || appId })
                ],

                onclick: () => {
                    if(manifest.external) {
                        if(typeof manifest.link !== "string" || !manifest.link) {
                            LS.Toast.show("This application does not have a valid link.", { accent: "red" });
                            return;
                        }

                        window.open(manifest.link, "_blank", "noopener");
                        app.desktop.closeToolbar();
                        return;
                    }

                    kernel.openApplication(manifest, { source: "appMenu" })
                        .loading(() => {
                            appButton.setAttribute("state", "loading");
                        })
                        .done((instance) => {
                            instance.open?.();
                            app.desktop.closeToolbar();
                        })
                        .catch(error => {
                            LS.Toast.show("Failed to open application: " + error.message, { accent: "red" });
                            console.error("Failed to open application:", error);
                        })
                        .finally(() => {
                            appButton.removeAttribute("state");
                        });
                }
            });

            this.appListElement.appendChild(appButton);
        }
    }

    _welcome(){
        this.closeToolbar(true);
        this.soundBox.play("system:startup");
        LS.Create("{Welcome to desktop mode}", {
    		style: "position: fixed; top: 50%; left: 50%; translate: -60% -50%; font-size: 4em; text-align: center; pointer-events: none; display: block; background: #0008; border-radius: 16px; padding: 4px 16px",
            parent: "top",
            ephemeral: true,
            animationOptions: { duration: 6000, easing: "ease" },
            animation: [
                { opacity: 0, offset: 0, filter: "blur(60px)" },
                { opacity: 1, offset: 0.25, filter: "blur(5px)" },
                { opacity: 1, offset: 0.50, filter: "blur(0)" },
                { opacity: 1, offset: 0.94 },
                { opacity: 0, translate: "-40% -50%", offset: 1 }
            ],
        });
    }

    /**
     * This constitutes ending the desktop session.
     */
    destroy() {
        // If we used the shared WM, we should reset it back instead of just deleting it.
        const replacingWM = this.windowManager === LS.WindowManager;
        this.windowManager.destroy(replacingWM);
        this.windowManager = null;

        for(const item of this.panelState) {
            this.destroyPanelComponent(item);
        }

        this.musicPlayer.destroy();
        this.musicPlayer = null;
        if(this.frameScheduler) {
            this.frameScheduler.destroy();
            this.frameScheduler = null;
        }

        window.removeEventListener("resize", this.__resizeHandler);
        this.toolbars.clear();
    }
}

export { LiDesktop, MediaPlayer };