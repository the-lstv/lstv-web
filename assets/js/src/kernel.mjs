// WARNING: The following imports are just a stub, the actual build system is being worked on.
import { TmpFs, RootFs } from "./fs.mjs";
import { SoundBox } from "./soundbox.mjs";
import { LiDesktop, MusicPlayer } from "./desktop.mjs";
import { LoggerContext, AssetManager, ContentContext, Viewport, Thread } from "./commons.mjs";
import { app } from "./shared.mjs";

/**
 * Kernel class
 * Main application kernel, handles global state, navigation, authentication, and content contexts.
 */
const kernel = new class Kernel extends LS.Context {
    version = KERNEL_VERSION;

    contexts = new Map();
    viewports = new Map();
    applications = new Map();
    pageCache = new Map();

    aliasMap = new Map();

    threads = new Set();

    fileSystem = RootFs.initRootFs();

    shortcutManager = shortcutManager;

    appManifests = new Map();

    queryParams = LS.Util.parseURLParams();
    userFragment = LS.Reactive.wrap("user", {});

    SPAExtensions = new LS.SPA.Matcher();

    MAX_THREADS = (navigator.hardwareConcurrency || 4) * 2;

    scheduler = new class Scheduler {
        constructor() {
        }
    }

    /**
     * Auth manager
     */
    auth = new class Auth extends LS.EventEmitter {
        #iframeURL = null;
        #iframeOrigin = null;

        constructor() {
            super();

            this.#iframeOrigin = `https://auth.extragon.${isDebug? "localhost": "cloud"}`;
            this.#iframeURL = `${this.#iframeOrigin}/bridge.html`;

            this.ready = false;
            this.loading = false;
            this.startupQueue = [];
            this.iframe = null;
            this.callbacks = new Map();
            this.helloTimeout = null;

            this.logger = new LoggerContext("auth");

            this.nonce = [...crypto.getRandomValues(new Uint32Array(4))].map(i => i.toString(36)).join("-");

            this.hello = false;
            window.addEventListener('message', e => {
                if (e.origin !== this.#iframeOrigin) return;
                if (e.data?.nonce && e.data.nonce !== this.nonce) return;

                if (!this.hello) {
                    if (e.data.data.initialized) {
                        this.hello = true;
                        this.helloTimeout && clearTimeout(this.helloTimeout);
                        this.helloTimeout = null;
                        this.logger.info('Auth bridge initialized.');
                        return;
                    } else return;
                }

                if (e.data.event && !e.data.id) {
                    this.quickEmit(e.data.event, e.data.data);
                    return;
                }

                const { id, error, data } = e.data;

                const cb = this.callbacks.get(id);
                if (cb) {
                    if (error) {
                        if (cb.callback) cb.callback(error);
                        if (cb.reject) cb.reject(error);
                    } else {
                        if (cb.callback) cb.callback(null, data);
                        if (cb.resolve) cb.resolve(data);
                    }

                    clearTimeout(cb.timeout);
                    this.callbacks.delete(id);
                }
            });
        }

        #getFrame(callback) {
            if (this.ready) {
                if (callback) callback();
                return;
            }

            if (this.loading) {
                if (callback) this.startupQueue.push(callback);
                return;
            }

            const error = error => {
                this.ready = false;
                if (callback) callback(error);
                if (this.startupQueue.length > 0) {
                    this.startupQueue.forEach(cb => cb(error));
                    this.startupQueue = [];
                }
                this.loading = false;
                this.logger.error('Error loading iframe:', error);
            };

            if(location.protocol !== 'https:') {
                LS.Toast.show("Authentication bridge must be loaded from https:// - account features are disabled.", { accent: "red" });
                error(new Error("Authentication iframe must be loaded from a secure https:// protocol."));
                return;
            }

            requestAnimationFrame(() => {
                this.loading = true;
                this.iframe = document.createElement('iframe');
                this.iframe.sandbox = "allow-scripts allow-same-origin";
                this.iframe.src = this.#iframeURL;

                this.iframe.style.position = "fixed";
                this.iframe.style.width = "0";
                this.iframe.style.height = "0";
                this.iframe.style.border = "0";
                this.iframe.style.opacity = "0";
                this.iframe.style.pointerEvents = "none";

                this.iframe.loading = 'eager';
                this.iframe.fetchPriority = "high";

                this.iframe.onload = () => {
                    this.iframe.contentWindow.postMessage({ type: 'init', nonce: this.nonce }, this.#iframeOrigin);
                    this.ready = true;
                    if (callback) callback();
                    if (this.startupQueue.length > 0) {
                        this.startupQueue.forEach(cb => cb());
                        this.startupQueue = [];
                    }

                    this.loading = false;

                    this.helloTimeout = setTimeout(() => {
                        if (!this.hello) {
                            this.ready = false;
                            this.logger.error('Auth iframe failed to respond.');
                            LS.Toast.show("Authentication bridge failed to respond - account features will not work.", { accent: "red" });
                        }
                    }, 1000);
                };

                document.body.appendChild(this.iframe);
                this.iframe.onerror = error;
                this.iframe.style.display = 'none';
            });
        }

        postMessage(action, data = {}, callback) {
            return new Promise((resolve, reject) => {
                const id = Math.random().toString(36).substring(2);

                const timeout = setTimeout(() => {
                    if (this.callbacks.has(id)) {
                        this.callbacks.delete(id);
                        reject(new Error(`Auth bridge timeout (${action})`));
                    }
                }, 30000);

                this.callbacks.set(id, { callback, resolve, reject, timeout });

                this.#getFrame((error) => {
                    if (error) {
                        reject(error);
                        clearTimeout(timeout);
                        this.callbacks.delete(id);
                        return;
                    }

                    this.iframe.contentWindow.postMessage({ action, id, ...data, nonce: this.nonce }, this.#iframeOrigin);
                });
            });
        }

        login(username, password, callback) {
            return this.postMessage('login', { username, password }, callback);
        }

        register(user, callback) {
            return this.postMessage('register', { user }, callback);
        }

        logout(callback) {
            return this.postMessage('logout', null, callback);
        }

        getUserFragment(callback) {
            return this.postMessage('getUserFragment', null, callback);
        }

        async isLoggedIn(callback) {
            const result = await this.postMessage('isLoggedIn', null, callback);
            app.isLoggedIn = result;
            return result;
        }

        patch(patch, callback) {
            return this.postMessage('patch', { patch }, callback);
        }

        fetch(url, options = {}, callback) {
            return this.postMessage('fetch', { url, options }, callback);
        }

        getIntentToken(scope, intents, callback) {
            return this.postMessage('getIntentToken', { scope, intents }, callback);
        }

        listAccounts(callback) {
            return this.postMessage('listAccounts', null, callback);
        }

        getActiveAccount(callback) {
            return this.postMessage('getActiveAccount', null, callback);
        }

        removeAccount(accountId, callback) {
            return this.postMessage('removeAccount', { accountId }, callback);
        }

        switchAccount(accountId, callback) {
            return this.postMessage('switchAccount', { accountId }, callback);
        }

        destroy() {
            if (this.iframe) {
                this.iframe.remove();
                this.iframe = null;
            }
            this.callbacks.clear();
            this.startupQueue = [];
            this.ready = false;
            this.loading = false;
        }
    }

    clearAllOtherPages(){
        for(const [path, page] of this.pageCache){
            if(this.viewport.current !== page){
                page.destroy();
            }
        }
    }

    /**
     * Permission scope
     */
    #PermissionScope = class PermissionScope {
        constructor(permissions = []) {
            this.permissions = Object.freeze(permissions);
            Object.freeze(this);
        }

        get auth() {
            if (!this.permissions.includes("auth")) throw new Error("This scope is not authorized to access authentication features.");
            return kernel.auth;
        }
    }

    /**
     * Kernel constructor/startup
     */
    constructor() {
        super('kernel');
        this.logger = new LoggerContext("kernel");

        const appElement = LS.SelectOrCreate('#app');
        const vpElement = LS.SelectOrCreate('#viewport');

        app.viewport = this.viewport = new Viewport('main', vpElement, {
            kernel: this
        });

        // Temporary
        if(window.__windowManagerTarget) appElement.append(window.__windowManagerTarget.children[0]);

        for(const manifest of BUILTIN_APPS) {
            this.appManifests.set(manifest.id, manifest);
        }

        this.ttl = Date.now() - window.__loadTime;
        this.log('Kernel initialized, version %c' + this.version + '%c, time since first load: ' + this.ttl + 'ms', 'font-weight:bold', 'font-weight:normal');

        // Register reactive types
        LS.Reactive.registerType("ProfilePicture", app.views.getProfilePictureView);
        LS.Reactive.registerType("ProfileBadges", app.views.getProfileBadgesView);
        LS.Reactive.registerType("ProfileBanner", app.views.getBannerView);
        LS.Reactive.registerType("ProfileLinks", app.views.getLinksView);
        LS.Reactive.registerType("ProfileBio", app.views.getBioView);
        LS.Reactive.registerType("DisplayName", (value, args, element, user) => {
            return value || user.displayname || user.username || "Anonymous";
        });

        LS.Reactive.registerType("ProfileUsername", (value, args, element, user) => {
            if(value === "admin") {
                const profile = element.closest(".profile");

                if(profile) {
                    profile.classList.add("admin");
                }
            }

            element.classList.add("profile-username");
            return "@" + (value || (user && user.username) || "anonymous");
        });

        LS.Reactive.registerType("ProfileEffects", (value, args, element, user) => {
            const profile = element.closest(".profile");
            if(!profile) return null;

            const effects = user.profileEffects || {};

            if(effects?.avatar?.id) {
                profile.setAttribute("avatar-effect", effects.avatar.id);
                profile.style.setProperty("--glow-primary", effects.avatar.primary || "var(--accent)");
                profile.style.setProperty("--glow-secondary", effects.avatar.secondary || "var(--accent-80)");
            } else {
                profile.removeAttribute("avatar-effect");
                profile.style.removeProperty("--glow-primary");
                profile.style.removeProperty("--glow-secondary");
            }

            if(effects?.style?.id) {
                profile.setAttribute("profile-style", effects.style.id);
            } else {
                profile.removeAttribute("profile-style");
            }

            if(effects?.style?.accent) {
                profile.setAttribute("ls-accent", effects.style.accent);
            } else {
                profile.removeAttribute("ls-accent");
            }

            profile.classList.toggle("fullscreen-banner", !!effects?.banner?.fullscreen);

            return null;
        });

        LS.Color.on("theme-changed", () => {
            for(const item of app.desktop.panelState) {
                if(item.kind === "themeButton" && item.element) {
                    item.element.querySelector("i").className = 'bi-' + (app.theme === "dark" ? "moon-stars" : "sun") + "-fill";
                }
            }
        });

        this.auth.on("user-updated", (patch) => {
            if (patch) {
                Object.assign(this.userFragment, patch);
            }
        });

        this.auth.on("account-switched", (reason, from, to) => {

        });

        this.addExternalEventListener(document, 'DOMContentLoaded', () => {
            app.container = this.container = document.getElementById('app');
            app.viewportElement = this.viewportElement = this.viewport.target;

            app.DESKTOP_MODE = localStorage.getItem("desktopMode") === "true";

            const scopeKey = document.querySelector("#scope-key")?.textContent || null;
            const context = this.registerPage(location.pathname, {
                element: this.viewportElement.firstElementChild,
                title: document.title,
                scripts: AssetManager._initialExternalAssets.scripts,
                styles: AssetManager._initialExternalAssets.styles,
                executeScripts: false, // Initial page scripts are already executed
                scopeKey,
            });

            AssetManager._initialExternalAssets = null;

            this.viewport.navigate(location.pathname, {
                browserTriggered: true,
                pushState: false,
                initial: true
            });

            this.__loaded = true;
            if (window.__init) {
                for (const initEntry of window.__init) {
                    this.registerModule(initEntry.script, initEntry.runtimeContext, context);
                }
                window.__init = null;
            }

            app.desktop.initPanel();
            this.#setupAuth();
            this.loadUser();

            // Display content
            document.querySelector(".loaderContainer").style.display = "none";
            app.container.style.display = "flex";
            app.emit("dom-ready");

            this.shortcutManager.assign("GLOBAL_OPEN_COMMAND_PALETTE", () => {
                if(!app.hasCapability("command-palette")) return;
                app.desktop.openPalette();
            });

            if(isBeta) {
                LS.Toast.show("You are using a beta version of lstv.space. Some features may be unstable or incomplete.", { accent: "orange", timeout: 60000 });
            }
        });

        // Event listener for back/forward buttons (for single-page app behavior)
        const originalState = location.pathname;
        window.addEventListener('popstate', (event) => {
            if(isDebug) this.log("Popstate event:", event);
            const href = event.state?.path ?? (location.pathname + location.hash);
            kernel.viewport.navigate(href, { pushState: false });
        });

        window.addEventListener('click', (event) => {
            const targetElement = event.target.closest("a");

            if (targetElement) {
                if(targetElement.hasAttribute("target")) return;

                const rawHref = targetElement.getAttribute('href');
                if(!rawHref) return;
                if(rawHref === "#") return event.preventDefault();

                const link = targetElement.href;
                let href = rawHref;

                if(link.startsWith(location.origin) && !link.endsWith("?") && !link.startsWith(location.origin + ":")){
                    try {
                        const parsed = new URL(link, location.href);
                        href = parsed.pathname + parsed.search + parsed.hash;
                    } catch (e) {
                        if(href.startsWith(location.origin)) href = href.substring(location.origin.length);
                    }

                    if(href.startsWith("#")) {
                        href = location.pathname + href;
                    }

                    const viewportElement = targetElement.closest(".viewport") || kernel.viewport.target;
                    if (viewportElement) {
                        const viewport = viewportElement.viewportInstance || [...kernel.viewports.values()].find(v => v.target === viewportElement);
                        if (viewport) {
                            event.preventDefault();
                            viewport.navigate(href, { targetElement });
                            return;
                        } else {
                            kernel.error("No viewport found for element", viewportElement);
                        }
                    } else {
                        kernel.error("No viewport element found", viewportElement);
                    }
                } else {
                    // TODO: Display confirm dialog
                    event.preventDefault();
                    window.open(link, '_blank', 'noopener');
                }
            }
        });

        const previewPopoutAnimationDuration = 350;

        const previewPopout = LS.Create("ls-box", {
            class: "link-preview-popout elevated",
            style: "display: none",
        }).addTo(LS._topLayer);

        const externalSitePreview = LS.Create([
            { tag: "ls-box", class: "link-preview-site contained", inner: [
                { class: "link-preview-favicon", tag: "img" },
                [
                    { class: "link-preview-domain text-overflow-nowrap" },
                    { class: "link-preview-title text-overflow-nowrap" },
                ]
            ] },
            { class: "link-preview-description" }
        ]);

        let popoutTimeout = null, lastLink = null, lastTarget = null;
        window.addEventListener("pointerover", (event) => {
            const targetElement = event.target.closest("a");
            if(targetElement && lastTarget !== targetElement) {
                if(targetElement.href.endsWith("#")) return;

                const link = targetElement.href;
                let href = targetElement.getAttribute('href');

                const isLocal = link.startsWith(origin);

                // For now
                if(isLocal) return;

                if(!link.endsWith("?") && !link.startsWith(origin + ":")){
                    if(href.startsWith(origin)) href = href.substring(origin.length);
                    lastTarget = targetElement;

                    clearTimeout(popoutTimeout);
                    let ct = popoutTimeout = setTimeout(() => {
                        const rect = targetElement.getBoundingClientRect();
                        const ww = window.innerWidth;
                        const wh = window.innerHeight;
                        
                        if(rect.top <= 300) {
                            previewPopout.style.top = (rect.bottom + 8) + "px";
                            previewPopout.style.bottom = "auto";
                        } else {
                            previewPopout.style.top = "auto";
                            previewPopout.style.bottom = (wh - rect.top + 8) + "px";
                        }
                        
                        previewPopout.style.left = (ww < 300 ? 0 : Math.max(8, Math.min(ww - 308, rect.left + rect.width / 2 - 150))) + "px";

                        if(lastLink !== link) {
                            previewPopout.innerHTML = "";
                            previewPopout.setAttribute("state", "loading");

                            if(!isLocal) {
                                fetch(app.api + "/metascraper?url=" + encodeURIComponent(link)).then(response => response.json()).then(data => {
                                    if(lastLink !== link) return;

                                    previewPopout.innerHTML = "";
                                    previewPopout.removeAttribute("state");
                                    externalSitePreview.querySelector(".link-preview-favicon").src = data && data.favicon && (data.favicon.startsWith("https://favicone.com/") ? data.favicon + "?s=48" : data.favicon) || "";
                                    externalSitePreview.querySelector(".link-preview-title").textContent = data && data.title || link;
                                    
                                    const description = data && data.description || "", descriptionContainer = externalSitePreview.querySelector(".link-preview-description"), siteBox = externalSitePreview.querySelector(".link-preview-site");
                                    if(description) {
                                        descriptionContainer.textContent = description;
                                        descriptionContainer.style.display = "block";
                                        siteBox.classList.remove("compact");
                                    } else {
                                        descriptionContainer.style.display = "none";
                                        siteBox.classList.add("compact");
                                    }

                                    let domain = "";
                                    try {
                                        const urlObj = new URL(link);
                                        domain = urlObj.hostname.replace("www.", "");
                                    } catch(e) {
                                        domain = link;
                                    }

                                    externalSitePreview.querySelector(".link-preview-domain").textContent = domain;
                                    previewPopout.appendChild(externalSitePreview);
                                });
                            }
                        } else {

                        }

                        lastLink = link;
                        LS.Animation.fadeIn(previewPopout, previewPopoutAnimationDuration, "up");
                    }, previewPopoutAnimationDuration);

                    targetElement.addEventListener("pointerout", () => {
                        if(!popoutTimeout || popoutTimeout !== ct) return;
                        clearTimeout(popoutTimeout);
                        lastTarget = null;
                        LS.Animation.fadeOut(previewPopout, previewPopoutAnimationDuration, "up");
                    }, { once: true });
                }
            }
        });

        this.on("context-updated", () => {
            LS.Animation.fadeOut(previewPopout, previewPopoutAnimationDuration, "up");
            lastTarget = null;
        })

        // --- Debug ONLY ---
        if (isDebug) {
            window.kernel = this;
            window.auth = this.auth;
            window.AssetManager = AssetManager;
        }

        // TODO:FIXME: This should only allow non-authenticated access
        app.fetch = this.auth.fetch.bind(this.auth);
        app.emit("ready");

        this.ttl_scripting = Date.now() - scriptingLoadTime;
    }

    /**
     * Registers a new viewport (target area for content)
     * @param {*} name Unique name of the viewport
     * @param {*} element The target DOM element
     */
    registerViewport(name, element) {
        return new Viewport(name, element);
    }

    /**
     * Register a fullscreen page for a specific path.
     * @param {*} path 
     * @param {*} options 
     * @returns 
     */
    registerPage(path, options) {
        path = LS.Util.normalizePath(path);

        if (this.pageCache.has(path)) {
            this.warn(`Page for path %c${path}%c is being registered twice. Overwriting existing page.`, 'font-weight: bold', '');
            this.pageCache.get(path).destroy();
        }

        const page = new ContentContext(options);
        page.setOptions({ path });
        this.log(`Registered page for path %c${path}`, 'font-weight: bold');
        return page;
    }

    /**
     * Gets a registered page by its path, resolving SPA extensions to the main.
     * It is recommended to use this method to reliably retrieve pages rather than using the map directly, because some pages may have initially loaded under a different URL or alias.
     * @param {string} path - The path of the page to retrieve.
     * @returns {ContentContext|null} The ContentContext object if found, otherwise null.
     */
    getPage(path) {
        path = LS.Util.normalizePath(path);
        const page = this.pageCache.get(path) || this.aliasMap.get(path);
        if (page) return page;

        const spaMatch = this.resolveSPAExtension(path);
        return spaMatch?.[2] || null;
    }

    /**
     * Resolve SPA extension for a given path, if any.
     * @param {string} path - The path to resolve.
     * @returns {Array|null}
     */
    resolveSPAExtension(path) {
        path = LS.Util.normalizePath(path);
        return this.SPAExtensions.match(path);
    }

    /**
     * Register a module/script scope with the application. This scope can request permissions and access APIs.
     * @param {*|ContentContext} script Script tag, unique identifier or the ContentContext registering the module.
     * @param {LS.Context} runtimeContext Class extending or instance of LS.Context holding the module logic. This class must either: implement a .destroy() method that calls super.destroy(), or subscribe to context.on("destroy") and guarantee proper cleanup. The context will be passed as the first argument.
     */
    registerModule(script, runtimeContext, context = null) {
        if(!runtimeContext || (typeof runtimeContext !== "function" && typeof runtimeContext !== "object")) {
            this.error("registerModule requires a valid runtimeContext class or instance, got:", runtimeContext);
            return null;
        }

        if (window.__init !== null && !this.__loaded) {
            // Still initializing
            window.__init.push({ script, runtimeContext });
            return;
        }

        // Try to determine context
        if (!context && script instanceof Node) {
            // First check a pre-set context
            if(script.registeringContext) {
                context = script.registeringContext;
            }

            // 1. Check registered pages
            if(!context) for (const page of this.pageCache.values()) {
                if (page.content && page.content.contains(script)) {
                    context = page;
                    break;
                }
            }

            // 2. Check viewports if not found in cache (e.g. anonymous pages)
            if (!context) {
                for (const viewport of this.viewports.values()) {
                    if (viewport.target.contains(script)) {
                        if (viewport.current && viewport.current.content.contains(script)) {
                            context = viewport.current;
                        }
                        break;
                    }
                }
            }
        }

        if (context) {
            this.log("Registered module for context", context.path || context.id);
        } else {
            this.warn("Registering module to global/unknown context", script);
            // Fallback: Use current page if we can't determine context
            context = kernel.viewport.current;
        }

        const ctxContent = context? context?.content: kernel.viewport.current?.content;

        const isClass = typeof runtimeContext === "function" && LS.Util.isClass(runtimeContext);
        if(!(runtimeContext instanceof LS.Context) && !isClass) {
            this.warn("Warning: registerModule runtimeContext should be a class extending LS.Context or an instance of LS.Context. Otherwise memory leaks are more likely. Violating context: ", context);
        }

        if(!context) {
            this.error("Failed to determine context for module", script);
            return null;
        }

        if (runtimeContext) {
            let moduleInstance = null;

            try {
                if(isClass) {
                    moduleInstance = new runtimeContext(context, ctxContent);
                } else if(runtimeContext instanceof LS.Context) {
                    runtimeContext.initialize(context, ctxContent);
                    moduleInstance = runtimeContext;
                } else if (typeof runtimeContext === "function") {
                    moduleInstance = new LS.Context();
                    runtimeContext.call(moduleInstance, context, ctxContent);
                } else {
                    this.error("registerModule runtimeContext must be a class extending LS.Context or an instance of LS.Context, got:", runtimeContext);
                    return null;
                }
    
                context.modules.add(moduleInstance);
            } catch (e) {
                this.error("Error initializing module for context", context?.path || context?.id, e);
                return null;
            }

            return moduleInstance;
        }
    }

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

    async loadUser() {
        this.log("Loading user data");

        let isLoggedIn = await this.auth.isLoggedIn();

        if (isLoggedIn) {
            try {
                const user = await this.auth.getUserFragment();
                this.userFragment.__bind.swapObject(user);
            } catch (error) {
                console.error("Failed to load user fragment:", error);
                isLoggedIn = false;
            }
        } else {
            this.userFragment.__bind.swapObject({});
        }

        this.loadUserList();

        app.events.emit("user-changed", [ isLoggedIn, this.userFragment ]);
        app.events.completed("user-loaded");

        if(!this.__pingsInitialized) this.#initializePings();
    }

    handleSPAExtension(href, extension, targetElement) {
        const [path, handler, context] = extension;
        if (typeof handler !== "function") {
            return;
        }

        const extendedPath = LS.Util.normalizePath(href.replace(path, ""), false);
        context.emit("spa-navigate", [ extendedPath, targetElement ]);
        handler(extendedPath, targetElement);
    }

    requestPermission(scope, permissions = []) {
        // For now, all scopes are granted without prompt (TEMPORARY)
        return new this.#PermissionScope(permissions);
    }

    async _initializeCommandPalette() {
        if (this._initializingPalette || app.desktop.commandPalette) return;
        const CommandPaletteExports = (await import("/~/assets/js/pallete.mjs?1.5"));
        CommandPaletteExports.init(this, app.desktop, LoggerContext);
        console.log("Command palette initialized");
    }

    /**
     * Anonymous statistics pings, helps to check for connectivity, check for updates from the server & receive remote updates, etc.
     * Do not disable completely unless you have a *very* good reason to, this is *not* invasive telemetry - privacy is fully respected (https://lstv.space/privacy-policy), and *nothing* is ever shared with 3rd parties for any reason.
     * If you want to limit the data sent to almost nothing without breaking the site, disable statistics sharing (settings privacy statistics false).
     * 
     * Timings are rounded to reduce precision for privacy.
     */
    #initializePings() {
        if (this.__pingsInitialized) return;
        this.__pingsInitialized = true;

        const PING_URL = '/check-in';
        const SESSION_ID = app.utils.generateIdentifier(); // True random ID
        let current_interval = 15000, first = true;

        const sendPing = (beacon = false) => {
            if (!beacon && (document.hidden || !document.hasFocus())) {
                setTimeout(() => sendPing(beacon), current_interval);
                return;
            }

            const STATS_DISABLED = localStorage.getItem("DISABLE_STATS") === "true";

            const data = JSON.stringify(!STATS_DISABLED? {
                sessionID: SESSION_ID,
                timestamp: Date.now(),
                kernel: KERNEL_VERSION,
                pagesLoaded: kernel.pageCache.size,
                viewports: kernel.viewports.size,
                contexts: kernel.contexts.size,
                threads: kernel.threads.size,
                currentPage: kernel.viewport.current?.path, // Does not include query or fragments, neither things like the content being viewed (eg. /post/123 will likely show up as just /post))
                userLoggedIn: app.isLoggedIn, // No identifiable info, just yes/no
                uptimeMs: Math.round(Date.now() - window.__loadTime),

                ...first ? {
                    platform: navigator.platform,
                    ttl: Math.round(this.ttl),
                    ttfp: Math.round(Date.now() - window.__loadTime),
                    origin: location.origin,
                    performanceMode: window.LOW_PERFORMANCE_MODE ? "low" : "normal", // User-set, does not relate to hardware capabilities
                    ls_version: LS.version
                } : {},

                ...beacon? { quit: true }: {}
            }: {
                sessionID: SESSION_ID,
                kernel: KERNEL_VERSION,
                uptimeMs: Math.round(Date.now() - window.__loadTime),

                // This further tells the server to avoid collecting anything, like IP addresses
                statsDisabled: true,

                ...first ? {
                    // ttfp and ttl is not sensitive and helps me see how the website performs for others in the real world
                    ttl: Math.round(this.ttl),
                    ttfp: Math.round(Date.now() - window.__loadTime)
                } : {}
            });

            if(beacon) {
                // Sent when ending a session naturally
                navigator.sendBeacon(PING_URL, data);
                return;
            }

            fetch(PING_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: data
            }).then(response => {
                if(response.ok) {
                    response.json().then(serverData => {
                        // TODO: handle server commands
                        if(serverData.updateAvailable) {
                            // TBA
                        }

                        first = false;
                        current_interval = Math.min(current_interval + 10000, 120000);
                        setTimeout(sendPing, current_interval);
                    }).catch(() => {
                        setTimeout(sendPing, current_interval);
                    });
                } else {
                    current_interval = Math.max(current_interval - 5000, 10000);
                    setTimeout(sendPing, current_interval);
                }
            }).catch(() => {
                setTimeout(sendPing, 5000);
            });
        };

        addEventListener('beforeunload', () => {
            sendPing(true);
        });

        sendPing();
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

    /**
     * Load the application with the given manifest.
     * @param {*} manifest 
     */
    async loadApplication(manifest) {
        const appId = manifest.id;
        if(!appId) {
            throw new Error("Application manifest is missing an id or name");
        }

        if (kernel.applications.has(appId)) {
            this.log("Application already loaded:", appId);
            return;
        }

        this.log("Loading application:", appId);
        
        // TODO: Special case for sandboxed apps
        if(typeof manifest.main !== "string") {
            throw new Error("Application manifest main path is missing or invalid");
        }

        if (/^https?:\/\//i.test(manifest.main)) {
            const RemoteIframeApp = class RemoteIframeApp extends ContentContext {
                constructor(options = {}) {
                    super({
                        title: manifest.name || manifest.id || "Untitled App",
                        description: manifest.description || "",
                        contextName: manifest.name || manifest.id || "App",
                        src: manifest.main,
                        sandboxMode: "iframe",
                        windowOptions: {
                            ...(manifest.windowOptions && typeof manifest.windowOptions === "object" ? manifest.windowOptions : {}),
                            ...(options.windowOptions && typeof options.windowOptions === "object" ? options.windowOptions : {})
                        }
                    });

                    this.window = this.createWindow({
                        title: manifest.name || manifest.id || "Untitled App",
                        icon: manifest.icon || null
                    });
                }

                open() {
                    this.window?.focus();
                    return this.window;
                }
            }

            kernel.applications.set(appId, RemoteIframeApp);
            RemoteIframeApp.manifest = manifest;
            return;
        }

        const module = await AssetManager.requireScript("/~/apps/" + manifest.main, true);
        const AppClass = module.default ?? module;

        if (typeof AppClass !== "function" || !LS.Util.isClass(AppClass) || !(AppClass.prototype instanceof ContentContext)) throw new Error("Application module does not export a default class or does not extend ContentContext");
        kernel.applications.set(appId, AppClass);
        AppClass.manifest = manifest;
    }

    *listResources() {
        for(const context of this.contexts.values()) {
            yield context;
        }

        for(const thread of this.threads.values()) {
            yield thread;
        }
    }

    /**
     * Instantiate an application by its ID.
     * @param {string} appId 
     * @param {object} options 
     * @returns {LS.Context}
     */
    instantiateApplication(appId, options = {}) {
        const AppClass = kernel.applications.get(appId);
        if (!AppClass) throw new Error("Application not found: " + appId);
        this.log("Instantiating application:", appId);

        // ! fix (this is not the right way to link)
        this._appInstantiationContext = {
            appId,
            manifest: this.appManifests.get(appId) || AppClass.manifest || null,
            options
        };

        try {
            return new AppClass(options);
        } finally {
            this._appInstantiationContext = null;
        }
    }

    /**
     * Open an application by its ID, and handle loading state and errors.
     * @param {string} appId 
     * @param {object} options
     */
    openApplication(manifest, options = {}) {
        const p = new OpenerPromise();

        queueMicrotask(() => {
            if(typeof manifest === "string") {
                manifest = kernel.appManifests.get(manifest);
                if(!manifest) {
                    return p.throw(new Error("Application manifest not found: " + manifest));
                }
            }

            const appId = manifest.id;

            if (!this.applications.has(appId)) {
                p.loadingState();

                this.loadApplication(manifest).then(() => {
                    try {
                        const instance = this.instantiateApplication(appId, options);
                        p.resolve(instance);
                    } catch (error) {
                        p.throw(error);
                    }
                }).catch(error => p.throw(error));
                return p;
            }

            try {
                const instance = this.instantiateApplication(appId, options);
                p.resolve(instance);
            } catch (error) {
                p.throw(error);
            }
        });

        return p;
    }

    log()   { this.logger.log(...arguments);   }
    warn()  { this.logger.warn(...arguments);  }
    error() { this.logger.error(...arguments); }

    destroy() {
        if(this.destroyed) return;
        for(const context of this.contexts.values()) {
            context.destroy();
        }

        for(const thread of this.threads.values()) {
            thread.destroy();
        }

        app.destroyState();

        this.contexts.clear();
        this.threads.clear();
        this.viewports.clear();
        this.pageCache.clear();
        this.aliasMap.clear();
        this.applications.clear();
        this.appManifests.clear();
        this.SPAExtensions.clear();
        this.logger.destroy();
        this.logger = null;
        this.auth.destroy();
        this.auth = null;

        super.destroy();
    }
}


/**
 * Promise helper
 */
class OpenerPromise {
    loading(callback)   { if (callback) this._l = callback; return this; }
    done(callback)      { if (callback) this._d = callback; return this; }
    catch(callback)     { if (callback) this._c = callback; return this; }
    finally(callback)   { if (callback) this._f = callback; return this; }
    loadingState(state) { if (this._l) this._l(state); return this;      }

    throw(error) {
        if (this._c) this._c(error);
        if (this._f) this._f();
        return this;
    }

    resolve(instance) {
        if (this._d) this._d(instance);
        if (this._f) this._f();
        return this;
    }

    dispose() {
        this._l = null;
        this._d = null;
        this._c = null;
        this._f = null;
    }
}

export { kernel };