/*
    lstv.space kernel
    Author: Lukas (thelstv)
    Copyright: (c) https://lstv.space
    No commercial or training use permitted.
    This code is not open-source.

    Last modified: 2026
    See: https://github.com/the-lstv/lstv-web
*/

try {
"use walker { walk $INPUT -v1.1 --no-exec --block-agents; _ifset PROD_BUILD else return 1; g-walker rebuild -I../glitter/compilers/ --toolset glitter-js-v8-specific --lang js -OM --format min -i $INPUT -o assets/js/kernel.js; ./merge.sh; }";

// WARNING: The following imports are just a stub, the actual build system is being worked on.

const KERNEL_VERSION = (typeof __buildVersion !== "undefined")? __buildVersion: "1.3.0-dev";

// TODO:
const BUILTIN_APPS = [
    {
        "name": "Townhall",
        "id": "townhall",
        "icon": "cd18c88051bcdc92.svg",
        "description": "A social community platform with servers, text & voice channels, threads, and more.",
        "version": "1.0.0",
        "link": "/chat"
    },
    {
        "name": "Video Editor",
        "id": "video-editor",
        "icon": "32c0975799f31fc3.svg",
        "description": "A full-featured, simple but professional video editor",
        "version": "1.0.0",
        "external": true,
        "link": "/editor"
    },
    {
        "name": "Resources",
        "id": "resource-monitor",
        "icon": "4cf4213e702a21fe.svg",
        "description": "Monitor loaded pages, applications, and other resources.",
        "version": "1.0.0",
        "main": "resourcemanager.mjs?1"
    },
    {
        "name": "Clock",
        "id": "clock",
        "icon": "d2973ce4286307f8.svg",
        "description": "What is the current time?",
        "version": "1.1.0",
        "main": "clock.mjs?0.1"
    },
    {
        "name": "Text Editor",
        "id": "text-editor",
        "icon": "ecf15bde6c275d83.svg",
        "description": "A simple Markdown text editor for your notes.",
        "version": "1.0.0",
        "main": "texteditor.mjs?0"
    },
    {
        "name": "Store",
        "id": "store",
        "icon": "8951e30e03967e75.svg",
        "description": "Get more apps and extensions!",
        "version": "1.0.0",
        "main": "store.mjs"
    },
    {
        "name": "Media Center",
        "id": "media-center",
        "icon": "5fe6243a90ae967a.webp",
        "description": "Your media hub.",
        "version": "1.0.0",
        "main": "media-center.mjs"
    },
    {
        "name": "Media Player",
        "id": "media-player",
        "icon": "5fe6243a90ae967a.webp",
        "description": "Play your media.",
        "version": "1.0.0",
        "main": "media-player.mjs"
    },
    {
        "name": "Music Player",
        "id": "music-player",
        "icon": "901fb7f3abda204f.svg",
        "description": "Play music, the pretty way!",
        "version": "1.0.0",
        "main": "music-player.mjs"
    },
    {
        "name": "File Manager",
        "id": "file-manager",
        "icon": "15043b26b7df5e3b.svg",
        "description": "Manage your files.",
        "version": "1.0.0",
        "main": "file-manager.mjs"
    },
    {
        "name": "Terminal",
        "id": "terminal",
        "icon": "c4972d221a92772b.svg",
        "description": "Use the command line & manage things",
        "version": "1.0.0",
        "main": "terminal.mjs"
    },
    {
        "name": "Calculator",
        "id": "calculator",
        "icon": "f0fb502ae0964022.svg",
        "description": "Perform various calculations.",
        "version": "1.0.0",
        "main": "calculator.mjs"
    },
    {
        "name": "WebView",
        "id": "webview",
        "icon": "62eb88beb684d561.svg",
        "description": "A simple embedded web browser.",
        "version": "1.0.0",
        "main": "webview.mjs"
    },
    {
        "name": "Email",
        "id": "mail-client",
        "icon": "901fb7f3abda204f.svg",
        "description": "Manage your emails.",
        "version": "1.0.0",
        "main": "mail.mjs"
    },
    {
        "name": "Mind Reader",
        "id": "mind-reader",
        "icon": "866c8c15f1ff50f1.svg",
        "description": "Reads your mind.",
        "version": "1.0.0",
        "main": "mind-reader.mjs"
    },
];
// localStorage.getItem("enableExperimentalApps") === "true" && {
//     "name": "monitors",
//     "id": "monitors",
//     "icon": "866c8c15f1ff50f1.svg",
//     "description": "",
//     "version": "1.0.0",
//     "main": "https://monitors.lstv.space",

//     windowOptions: {
//         width: 800,
//         height: 600
//     }
// }

// --- INITIALIZATION STUFF & DEFINITIONS (SKIP THIS PART)
// If the environment is correct, this file should be wrapped in an IIFE by the build system & not leak.

if(window.__kernelInitialized) {
    throw new Error("Kernel was already initialized - this is a bug!");
}

if(globalThis === this) {
    throw new Error("Kernel was loaded at the top level, this is a bug");
}

window.__kernelInitialized = true;

// Mtime mapped to kernel.js (This should never fallback)
window.cacheKey = "?mtime=" + (LS.Util.parseURLParams(document.currentScript?.src, "mtime") || Date.now());

if(!window.LS || typeof LS !== "object" || LS.v < 5) {
    window.__loadError('<h3 style="margin:40px 20px">The application framework failed to load. Please try again later.</h3>')
    throw new Error("Fatal error: Missing LS, or it's too old! Make sure it was loaded properly! Aborting.");
}

// Forward declarations
const scriptingLoadTime = Date.now();
const shortcutManager = new LS.ShortcutManager();
const isDebug = window.location.hostname === "lstv.localhost";
const isBeta = window.location.hostname.startsWith("beta.lstv.");

shortcutManager.map({
    "GLOBAL_OPEN_COMMAND_PALETTE": ['ctrl+shift+p', 'ctrl+k'],
    "GLOBAL_OPEN_MUSIC_PLAYER": ['ctrl+shift+alt+m', 'ctrl+alt+shift+m'],
    "GLOBAL_DESKTOP_OPEN_MENU": ['ctrl+space', 'ctrl+shift+m', 'ctrl+alt+m'],
    "GLOBAL_LOCK_SCREEN": ['ctrl+shift+l', 'ctrl+alt+l'],
    "GLOBAL_LOG_OUT": ['ctrl+shift+q', 'ctrl+alt+q'],
    "GLOBAL_OPEN_TERMINAL": ['ctrl+shift+t', 'ctrl+alt+t'],

    ...{} // todo: User data
});

// Console welcome message
if(!isDebug) console.log(
    '%c LSTV %c\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO STEAL PERSONAL INFORMATION OR SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#e74c3c, #e74c3c 33%, #f39c12 33%,#f39c12 66%,#3498db 66%,#3498db);border-radius:1em;color:white;font-weight:900;margin:1em 0',
    'font-size:1.5em;color:#ed6c30;font-weight:bold',
    'font-size:1em;font-weight:400'
);

Document.prototype.write = Document.prototype.writeln = function() {
    throw new Error("Document.write is disabled for security and performance reasons. You should not use it.");
};

// --- MEMORY SAFETY ---
// We can use globals in the kernel code, anywhere else should throw an error.
// This is to help catch bad code before it causes leaks.
// Not needed in production, but can be useful during development, eg. if I forget to correctly isolate something.
// Why am I writing comments that nobody will read.

// LS.Context.debugEnforceContextSafety();
// LS.Context.debugWarnContextSafety();

const setTimeout = LS.Context.setTimeout;
const setInterval = LS.Context.setInterval;
const clearTimeout = LS.Context.clearTimeout;
const clearInterval = LS.Context.clearInterval;
const requestAnimationFrame = LS.Context.requestAnimationFrame;
const queueMicrotask = LS.Context.queueMicrotask;
const fetch = LS.Context.fetch;

function invokeAndReturn(f) { f(); return f }// WARNING: The following imports are just a stub, the actual build system is being worked on.

// --- COMMON CLASSES

/**
 * LoggerContext class
 * Provides unified logging utilities and is meant to isolate logging per context, and redirect logs to different writers when needed.
 */
class LoggerContext {
    constructor(context, writer = null) {
        this.logContext = context;
        this._tag = `%c[${context}]%c`;
        this._tagStyle = 'font-weight: bold';
        this._writer = writer;
    }

    set tag(value) {
        this._tag = `%c[${value}]%c`;
    }

    set tagStyle(style) {
        this._tagStyle = style;
    }

    get writer() {
        return this._writer || window.Logger || console;
    }

    set writer(value) {
        this._writer = value;
    }

    writeLog(func = console.log, tagStyle, message, ...data) {
        if(this.destroyed) return;
        const isString = typeof message === 'string';
        if(!isString) data.unshift(message);

        func.call(this.writer, this._tag + (isString ? " " + message : ''), tagStyle + this._tagStyle, 'color: inherit; font-weight: normal;', ...data);

        // if (website.emit) website.emit('global-log-stream', [this.logContext, message, ...data]);
    }

    log(...data) {
        this.writeLog(this.writer.log, 'color: #3498db;', ...data);
    }

    error(...data) {
        this.writeLog(this.writer.error || this.writer.log, 'color: #e74c3c;', ...data);
    }

    warn(...data) {
        this.writeLog(this.writer.warn || this.writer.log, 'color: #f39c12;', ...data);
    }

    info(...data) {
        this.writeLog(this.writer.info || this.writer.log, 'color: #9b59b6;', ...data);
    }

    destroy() {
        this.logContext = null;
        this._writer = null;
        this._tag = null;
        this._tagStyle = null;
        this.destroyed = true;
    }
}


/**
 * GlobalAsset manager
 * Keeps track of globally registered assets (styles and scripts) to avoid duplicates.
 * Website only
 */
const AssetManager = new class {
    constructor() {
        this.styles = new Map();
        this.scripts = new Map();
        this.whitelist = new Set(); // Default assets

        this._initialExternalAssets = {
            scripts: [],
            styles: []
        }

        // Pre-register existing global assets
        Array.from(document.head.querySelectorAll('link[rel="stylesheet"], script[src]')).forEach(asset => {
            const key = this.#toKey(asset);

            // Yeah, hardcoding is not the best idea
            // But this needs to filter all persistent assets
            if(asset.classList.contains("whitelist") || key.includes("/ls/") || key.includes("bootstrap-icons") || key.includes("fonts.googleapis.com") || key.includes("/assets/js/kernel.js") || key.includes("/assets/css/main.") || key.includes("/assets/js/pallete.js")) {
                this.whitelist.add(key);
            } else {
                if(asset instanceof HTMLLinkElement) {
                    this._initialExternalAssets.styles.push(asset);
                } else if(asset instanceof HTMLScriptElement) {
                    this._initialExternalAssets.scripts.push(asset);
                }
            }

            asset.setAttribute("data-loaded", "true");
            this.register(asset, false);
        });
    }

    #toKey(source) {
        return this.fuzzKey((source instanceof HTMLLinkElement) ? source.href : (source instanceof HTMLScriptElement) ? source.src : source);
    }

    fuzzKey(source) {
        let absSource = source;
        try {
            absSource = new URL(source, location.origin).href;
        } catch (e) {}
        return absSource.replace(/(\?|#).*$/,'').replace(/\/+$/,'').toLowerCase();
    }

    has(source){
        const key = this.#toKey(source);
        return this.styles.has(key) || this.scripts.has(key);
    }

    get(source){
        const key = this.#toKey(source);
        return this.styles.get(key) || this.scripts.get(key);
    }

    register(element, execute = true){
        if(element instanceof HTMLLinkElement){
            this.registerStyle(element.href, element, execute);
        } else if(element instanceof HTMLScriptElement){
            this.registerScript(element.src, element, execute);
        }
    }

    async registerStyle(source, element, execute = true){
        const key = this.fuzzKey(source);
        if(this.styles.has(key)) return;
        this.styles.set(key, element);

        if(isDebug) {
            console.log(`Registered style: ${source} (execute=${execute})`);
        }

        if (execute) {
            if(!element.href) {
                document.head.appendChild(element);
                element.remove();
                return;
            }

            await new Promise((resolve, reject) => {
                element.onload = () => resolve();
                element.onerror = (e) => reject(e);
                document.head.appendChild(element);
            }).catch((e) => {
                console.error(`Failed to load style: ${source}`, e);
            });

            element.setAttribute("data-loaded", "true");
            element.remove();
        }
    }

    async registerScript(source, element, execute = true){
        const key = this.fuzzKey(source);
        if(this.scripts.has(key)) return;
        this.scripts.set(key, element);

        if(isDebug) {
            console.log(`Registered script: ${source} (execute=${execute})`);
        }

        if (execute) {
            if(!element.src) {
                document.head.appendChild(element);
                element.remove();
                return;
            }
        
            await new Promise((resolve, reject) => {
                element.onload = () => resolve();
                element.onerror = (e) => reject(e);
                document.head.appendChild(element);
            }).catch((e) => {
                console.error(`Failed to load script: ${source}`, e);
            });

            element.setAttribute("data-loaded", "true");
        
            element.remove();
        }
    }

    requireStyle(source) {
        return new Promise((resolve, reject) => {
            if (this.has(source)) {
                resolve(this.get(source));
                return;
            }

            const style = LS.Create('link', {
                rel: 'stylesheet',
                href: source
            });

            style.onload = () => resolve(style);
            style.onerror = (e) => reject(e);
            this.registerStyle(source, style);
        });
    }

    disableStyle(source) {
        const key = this.#toKey(source);
        const style = this.styles.get(key);
        if(style instanceof HTMLStyleElement) {
            style.disabled = true;
        } else if(style instanceof HTMLLinkElement) {
            // Apparently this STILL does not prevent re-fetching the style...
            style.media = 'not all';
        }
    }

    enableStyle(source) {
        const key = this.#toKey(source);
        const style = this.styles.get(key);
        if(style instanceof HTMLStyleElement) {
            style.disabled = false;
        } else if(style instanceof HTMLLinkElement) {
            style.media = 'all';
        }
    }

    async requireScript(source, module = false) {
        if(module && typeof source === "string") {
            return import(source);
        }

        if (this.has(source)) {
            return this.get(source);
        }

        let script = this.cloneScript(source, module);
        return await this.registerScript(script.src, script, true);
    }

    cloneScript(source, module = false) {
        if (source instanceof HTMLScriptElement) {
            const old = source;
            const script = document.createElement('script');
            for (const attr of old.attributes) {
                script.setAttribute(attr.name, attr.value);
            }
            if (!old.src) {
                script.textContent = old.textContent;
            }
            return script;
        } else if (typeof source === "string") {
            const script = document.createElement('script');
            if (module) {
                script.type = "module";
            }
            script.src = source;
            return script;
        }
        return null;
    }

    cloneStyle(source) {
        if (source instanceof HTMLLinkElement) {
            const old = source;
            const style = document.createElement('link');
            for (const attr of old.attributes) {
                style.setAttribute(attr.name, attr.value);
            }
            return style;
        } else if (source instanceof HTMLStyleElement) {
            const old = source;
            const style = document.createElement('style');
            style.textContent = old.textContent;
            return style;
        } else if (typeof source === "string") {
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = source;
            return style;
        }
        return null;
    }

    remove(source) {
        if (source instanceof Node) {
            try { source.remove(); } catch {}

            for (const [k, v] of this.styles) {
                if (v === source) { this.styles.delete(k); break; }
            }
            for (const [k, v] of this.scripts) {
                if (v === source) { this.scripts.delete(k); break; }
            }
            return;
        }

        const key = this.#toKey(source);
        const style = this.styles.get(key);
        if(style) {
            style.remove();
            this.styles.delete(key);
            return;
        }
        const script = this.scripts.get(key);
        if(script) {
            script.remove();
            this.scripts.delete(key);
        }
    }
}


/**
 * ContentContext class
 * This is a base class representing a content context, such as a specific webpage or view.
 * Partly handles context management.
 * (This does not equal a whole application, and application may have multiple content contexts.)
 */
class ContentContext extends LS.View {
    #path = null;

    // Only used for applications
    static manifest = {};

    constructor(options = {}) {
        super();

        this.id = "context-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now().toString(36);

        // Can be awaited to make sure content is loaded
        this.loadPromise = null;

        this.styles = [];
        this.scripts = [];

        this.SPAPatterns = [];

        this.modules = new Set();

        this.content = null;

        // FIXME: Sandboxing needs to be better implemented

        this.state = "empty"; // empty | ready | suspended | destroyed
        this.sandboxMode = "none"; // none | shadow | iframe

        this.loaded = false;
        this.error = null;

        if(options) {
            this.setOptions(options);
        }

        this.logContext = new LoggerContext(`Context:${this.#path || this.src || this.id}`);
        this.log = this.logContext.log.bind(this.logContext);

        kernel.contexts.set(this.id, this);
        kernel.quickEmit("context-created");

        this.scopeKey = null;

        // this.on("resume", async () => {});
    }

    get visibleName() {
        return this.title || this.id || this.constructor.manifest.name || this.constructor.manifest.id || "Unnamed Context";
    }

    get icon() {
        return this.constructor.manifest.icon || null;
    }

    async #loadCSS(){
        const promises = [];
        for (const style of this.styles) {
            if (style.isConnected || style.hasAttribute("data-loaded")) continue;
            if (style.tagName !== "LINK") {
                document.head.appendChild(style);
                continue;
            }

            promises.push(new Promise((resolve, reject) => {
                style.onload = () => resolve();
                style.onerror = (e => reject(e));
                document.head.appendChild(style);
            }).then(() => {
                style.setAttribute("data-loaded", "true");
            }).catch((e) => {
                console.error(`Failed to load style: ${style.href}`, e);
            }));
        }

        await Promise.all(promises);
    }

    async #loadJS(){
        const promises = [];
        for (const script of this.scripts) {
            if (script.isConnected || script.hasAttribute("data-loaded")) continue;
            if(this.destroyed) return;

            if (!script.src) {
                document.head.appendChild(script);
                script.remove();
                continue;
            }

            const promise = new Promise((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = (e) => reject(e);
                document.head.appendChild(script);
            }).then(() => {
                script.setAttribute("data-loaded", "true");
            }).finally(() => {
                script.remove();
            });

            if(script.async) {
                promises.push(promise);
            } else {
                await promise;
            }
        }

        if(promises.length > 0) await Promise.all(promises);
    }

    createWindow(options) {
        const appContext = this.instantiationContext || this.constructor._appInstantiationContext;
        const manifestWindowOptions = appContext?.manifest?.windowOptions && typeof appContext.manifest.windowOptions === "object" ? appContext.manifest.windowOptions : null;
        const appOpenWindowOptions = appContext?.options?.windowOptions && typeof appContext.options.windowOptions === "object" ? appContext.options.windowOptions : null;

        const mergedOptions = {
            // Wait for the context to finish rendering before showing the window
            waitForRender: true,

            // When the window is closed, the context will be destroyed with it.
            ownsContent: true,

            ...(manifestWindowOptions || {}),
            ...(this.windowOptions || {}),
            ...(appOpenWindowOptions || {}),
            ...(options || {})
        };

        const win = new LS.Window(mergedOptions);
        win.set(this);

        this.render(this.container).then(() => {
            win.quickEmit("rendered");
            return true;
        }).catch((e) => {
            kernel.error("Rendering from context failed:", e);
            this.errorPage(500);
            return false;
        });

        this.addDestroyable(win);
        return win;
    }

    get path() {
        return this.#path || null;
    }

    setOptions(options){
        if(typeof options !== "object") return;

        // Flag that specifies if the page requires a full reload when navigated to
        if(options.requiresReload) this.requiresReload = true;

        // Flag that specifies if the page can handle logins dynamically (without reload)
        // Currently it does nothing, in the future pages that don't have this flag may be suspended on login/logout until they confirm or reload
        if(options.dynamicAccount) this.dynamicAccount = true;

        // Metadata
        if(options.title) this.title = options.title;
        if(options.description) this.description = options.description;

        if(options.src) this.src = options.src;

        if(options.element) {
            this.fromElement(options.element);
        }

        if(options.text) {
            this.fromText(options.text);
        }

        if(options.sandboxMode) {
            this.sandboxMode = options.sandboxMode;
        }

        if(options.windowOptions && typeof options.windowOptions === "object") {
            this.windowOptions = {
                ...(this.windowOptions || {}),
                ...options.windowOptions
            };
        }

        if(options.scripts && Array.isArray(options.scripts)) {
            for(const script of options.scripts) {
                if(!this.scripts.includes(script)) this.scripts.push(script);
            }
        }

        if(options.styles && Array.isArray(options.styles)) {
            for(const style of options.styles) {
                if(!this.styles.includes(style)) this.styles.push(style);
            }
        }

        // Only for contexts with a path; all aliases, INCLUDING the canonical path should be set here to help with duplicate resolution.
        if(options.aliases && Array.isArray(options.aliases)) {
            this.aliases = options.aliases.map(alias => LS.Util.normalizePath(alias));
            for(const alias of this.aliases) {
                kernel.aliasMap.set(alias, this);
            }
        }

        // Unique path that clearly identifies this context, not required for non-page contexts.
        if (options.path) {
            const newPath = LS.Util.normalizePath(options.path);
            if (this.#path && this.#path !== newPath) {
                // Remove old path from cache if changed
                if (kernel.pageCache.get(this.#path) === this) {
                    kernel.pageCache.delete(this.#path);
                }
            }

            // Check for collision
            const existing = kernel.pageCache.get(newPath);
            if (existing && existing !== this) {
                throw new Error(`Context path collision: "${newPath}" is already taken by another context.`);
            }

            this.#path = newPath;
            kernel.pageCache.set(newPath, this);
        }

        if(options.contextName) {
            if(this.logContext) {
                this.logContext.tag = `Context:${options.contextName}`;
            } else {
                console.warn("huh", this);
            }
        }

        if(options.scopeKey) {
            this.scopeKey = options.scopeKey;
            if(this.content) this.content.setAttribute('file-scope', options.scopeKey);
        }

        if(options.hasOwnProperty("destroyOnUnload")) this.destroyOnUnload = options.destroyOnUnload || false;

        kernel.quickEmit("context-updated");
    }

    async render(targetElement = null){
        if(this.state === "loading" || this.state === "destroyed" || (this.state === "ready" && targetElement && this.content && targetElement.contains(this.content))) {
            return this;
        }

        this.state = "loading";
        this.prepareEvent("loaded", {
            completed: false // Uncomplete the event
        });

        let renderCompleted = false;

        try {
            if(this.src && this.sandboxMode !== "iframe" && !this.loaded) {
                await (this.loadPromise || this.fromURL());
                if(this.destroyed) return this;
            }


            if(this.sandboxMode === "iframe" && !(this.content instanceof HTMLIFrameElement)) {
                this.replaceContent(); // Create iframe
            } else if (!this.content) {
                this.error = 500;
                this.state = "empty";
                return;
            }

            // console.log("Waiting for assets", this.styles, this.scripts);
            // Unsure whether to load JS and CSS in parallel (before render) or load JS separately after render, since some scripts may expect DOM to exist.
            // Loading early allows for quicker execution though (eg. if JS is responsible for rendering something, it will be available before actually displaying).
            await Promise.all([
                this.#loadCSS(),
                this.#loadJS()
            ]);

            for (const style of this.styles) {
                AssetManager.enableStyle(style);
            }

            await new Promise((resolve) => setTimeout(resolve, 0));

            if(this.destroyed) return this; // :(

            this.completed("loaded"); // Assets have finished loading

            if(targetElement) {
                if (this.sandboxMode === "shadow") {
                    if (!targetElement.shadowRoot) targetElement.attachShadow({ mode: 'open' });
                    targetElement.shadowRoot.replaceChildren(this.content);
                } else {
                    targetElement.replaceChildren(this.content);
                }
            }

            this.state = "ready";

            // await this.#loadJS();
            this.emit("resume", targetElement);
            this.loaded = true;
            renderCompleted = true;

            return this;
        } catch (e) {
            this.state = "empty";
            this.loaded = false;
            this.error ??= 500;
            throw e;
        } finally {
            if(!renderCompleted && this.state === "loading") {
                this.state = this.loaded ? "ready" : "empty";
            }
        }
    }

    // TODO: This needs to be worked on
    registerSPAExtension(pattern, handler) {
        if (Array.isArray(pattern)) {
            for (const p of pattern) {
                this.registerSPAExtension(p, handler);
            }
            return;
        }

        pattern = LS.Util.normalizePath(pattern || this.#path);
        kernel.SPAExtensions.add(pattern, [kernel.SPAExtensions.getBasePath(pattern), handler, this]);
        this.SPAPatterns.push(pattern);
    }

    requestPermission(permissions = []) {
        return kernel.requestPermission(this, permissions);
    }

    fromElement(element){
        if(this.sandboxMode === "iframe") {
            console.warn("fromElement() called with iframe sandbox mode. You probably didn't mean to do that. The element will *not* be used, a copy will be made instead.");
            this.__rawContent = element.outerHTML;
            return this;
        }

        this.replaceContent(element);
        this.processAssetsOnNode(element);
        return this;
    }

    fromText(text){
        if(this.sandboxMode === "iframe") {
            this.__rawContent = text;
            return this;
        }

        this.replaceContent(LS.Create({
            class: 'page page-content',
            innerHTML: text
        }));
        this.processAssetsOnNode(this.content);
        return this;
    }

    fromURL(newURL = null){
        if(newURL) {
            this.src = newURL;
            this.loaded = false;
        }

        if(this.loadPromise) return this.loadPromise;
        if(this.loaded || this.sandboxMode === "iframe") return Promise.resolve(this);

        this.loadPromise = new Promise(async (resolve, reject) => {
            if(!this.src) {
                reject(new Error("No URL specified"));
                return;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            try {

                const response = await fetch(this.src, {
                    signal: controller.signal,
                    headers: {
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        // "Akeno-Content-Only": "true" // FIXME: Currently not implemented on backend
                    }
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    this.error = response.status;
                    reject(new Error(`${response.status} ${response.statusText}`));
                    this.loadPromise = null;
                    return;
                }

                const text = await response.text();
                if (this.destroyed) {
                    reject(new Error("Context was destroyed during load"));
                    this.loadPromise = null;
                    return;
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                const newContent = doc.querySelector('#viewport')?.firstElementChild;
                if (!newContent) {
                    this.error = 404;
                    reject(new Error("404 Not Found"));
                    this.loadPromise = null;
                    return;
                }

                this.scopeKey = doc.querySelector("#scope-key")?.textContent || null;

                doc.querySelectorAll('img, link[rel="stylesheet"], script[src], [href]').forEach(el => {
                    ['src', 'href'].forEach(attr => {
                        if (el.hasAttribute(attr)) {
                            el.setAttribute(attr, new URL(el.getAttribute(attr), this.src).href);
                        }
                    });
                });

                this.processAssetsOnNode(doc);

                document.adoptNode(newContent); // The original may be safely deleted after this
                this.replaceContent(newContent);
                this.title = doc.title;
                resolve(this);
            } catch (e) {
                // Distinguish between network errors and other errors
                if (e.name === 'AbortError' || e instanceof TypeError) {
                    reject(new Error("Network error: Failed to load page. Please check your connection."));
                } else {
                    reject(e);
                }
            } finally {
                clearTimeout(timeout);
                this.loadPromise = null;
            }
        });

        return this.loadPromise;
    }

    processAssetsOnNode(element) {
        for (const style of element.querySelectorAll('link[rel="stylesheet"], style')) {
            if(style.hasAttribute('data-asset-ignore') || style.classList.contains('whitelist')) continue;
            if(style.tagName === "LINK") {
                if(AssetManager.whitelist.has(AssetManager.fuzzKey(style.href || ''))) continue;

                let styleElement = AssetManager.get(style);
                if(styleElement) {
                    this.styles.push(styleElement);
                    continue;
                }

                styleElement = AssetManager.cloneStyle(style);
                this.styles.push(styleElement);
                AssetManager.registerStyle(style.href, styleElement, false);
            } else if (style.ownerDocument !== document) {
                let styleElement = AssetManager.cloneStyle(style);
                this.styles.push(styleElement);
            }
        }

        for (const script of element.querySelectorAll('script[type="text/javascript"], script:not([type])')) {
            if(script.hasAttribute('data-asset-ignore') || script.classList.contains('whitelist') || (script.src && AssetManager.whitelist.has(AssetManager.fuzzKey(script.src || '')))) continue;

            if(script.src) {
                let scriptElement = AssetManager.get(script);
                if(scriptElement) {
                    this.scripts.push(scriptElement);
                    script.remove();
                    continue;
                }

                scriptElement = AssetManager.cloneScript(script);
                scriptElement.registeringContext = this;
                this.scripts.push(scriptElement);
                AssetManager.registerScript(script.src, scriptElement, false);
                script.remove();
            } else if (script.ownerDocument !== document) {
                let scriptElement = AssetManager.cloneScript(script);
                scriptElement.registeringContext = this;
                this.scripts.push(scriptElement);
            }
        }

        element = null;
    }

    /**
     * This method is used even when setting the content for the first time
     */
    replaceContent(newContent){
        if(this.sandboxMode === "iframe") {
            const iframe = document.createElement("iframe");
            iframe.classList.add("page");
            iframe.classList.add("page-sandbox-iframe");
            iframe.allow = this.sandboxAllow || "fullscreen; clipboard-write";
            iframe.sandbox = this.sandboxOptions || "allow-scripts allow-same-origin allow-modals allow-popups allow-downloads allow-forms allow-presentation";
            iframe.style.border = "none";
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            if(this.src) {
                iframe.src = this.src;
            } else {
                iframe.srcdoc = this.__rawContent || "<html><body><h3>Empty content.</h3></body></html>";
            }
            this.content = iframe;

            iframe.addEventListener("load", () => {
                this.loaded = true;
                this.emit("ready");
            }, { once: true });

            this.error = null; // Sadly no way to track errors in iframes
            return this;
        }

        if(this.content && this.content !== newContent) {
            // Not sure I should do this, it's not even consistent across sandbox modes so idk
            if(this.content.parentNode && this.content !== newContent) {
                this.content.parentNode.replaceChild(newContent, this.content);
            } else {
                this.content.remove();
            }
        }

        if(this.scopeKey) {
            newContent.setAttribute('file-scope', this.scopeKey);
        }

        newContent.classList.add("page");
        LS.Reactive.scan(newContent); // Scan for reactive bindings
        this.content = newContent;
        this.error = null;
        return this;
    }

    /**
     * @experimental
     */
    async reload(){
        this.loaded = false;
        this.loadPromise = null;
        return await this.fromURL();
    }

    /**
     * Suspends the context, disables styles and detaches content.
     * The context will still exist and be kept in memory.
     */
    suspend(){
        this.state = "suspended";

        this.emit("suspend");

        this.__previousParent = this.content?.parentNode || null;
        this.content?.remove();
        for(const style of this.styles) {
            AssetManager.disableStyle(style);
        }

        if(this.destroyOnUnload) {
            this.destroy();
        } else {
            kernel.quickEmit("context-updated");
        }
        return this;
    }

    /**
     * Resumes the context, re-enables styles and re-attaches content.
     * Normally there is no need to call this manually, render() does it automatically.
     */
    resume(){
        if(this.state !== "suspended") return this;
        this.state = "ready";
        kernel.quickEmit("context-updated");
        this.emit("resume", this.__previousParent);
        this.render(this.__previousParent || undefined);
        return this;
    }

    /**
     * Equivalent to website.watchUser, scoped to this context.
     * Gets called once when the user state is loaded, and then every time the user state changes.
     * 
     * You MUST use this to signal that your context is aware of dynamic user state changes, otherwise the kernel can suspend or reload your context on login/logout.
     * 
     * @param {*} callback Callback function that receives (isLoggedIn, userFragment) when the user state changes.
     * @returns {void}
     * 
     * @example
     * // The following will run at least once as soon as the user state is available, and then every time the user state changes.
     * context.watchUser((isLoggedIn, userFragment) => {
     *     if(isLoggedIn) {
     *         console.log("User logged in:", userFragment);
     *     } else {
     *         console.log("User logged out");
     *     }
     * });
     */
    watchUser(callback) {
        app.once("user-loaded", () => {
            if(this.destroyed) return;

            callback(app.isLoggedIn, app.userFragment);
            this.addExternalEventListener(app, "user-changed", callback);
        });
    }

    registerModule(runtimeContext) {
        if(this.destroyed) return;
        return kernel.registerModule(this, runtimeContext, this);
    }

    async requestKernelAccess(reason = "unspecified") {
        // TODO: Verify access and integrity.

        return new Promise((resolve, reject) => {
            let allowed = false;
            const modal = LS.Modal.buildEphemeral({
                class: "white-space: pre",

                content: [
                    { emmet: "h1.bi-exclamation-triangle-fill", style: "text-align: center; margin-top: 0; margin-bottom: 10px; font-size: xxx-large" },
                    { style: "white-space: pre-wrap", inner: ["An external app or process (\"" + (this.visibleName || this.title || this.name) + "\") wants ", { tag: "strong", text: "full (\"root\") access over this system" } ,".\n\nReason given by the app:\n", { tag: "code", text: reason } , { tag: "span", style: "font-size: smaller", text: "\n\nPlease keep in mind: Unlike permissions, this grants full control and could allow 3rd parties to access your private data. Make sure you fully trust the source before allowing.\nIf someone instructed you to allow this, they are almost certainly trying to scam you. Please deny this request if you don't recognize the source." }] }
                ],

                buttons: [
                    { label: "Deny", class: "elevated" },

                    // TODO: captcha/better button
                    { label: "Allow", onclick: (e) => {
                        if(!e.isTrusted) {
                            return;
                        }

                        allowed = true;
                        resolve(kernel);
                        console.log("Context got access to the kernel: ", this);
                        LS.Toast.show("Kernel access request was granted to " + (this.visibleName || this.title || this.name), { accent: "green", timeout: 2000 });
                        LS.Modal.closeFromElement(e.target);
                    } }
                ]
            });
            
            modal.once("destroy", () => {
                if(allowed) return;
                LS.Toast.show("Kernel access request denied.", { accent: "red", timeout: 2000 });
                // this.destroy();
                // throw new Error("Kernel access request denied.");
                reject(new Error("User denied kernel access"));
            });
        });
    }

    /**
     * Destroys the context, unloads assets and removes content.
     * After destroying, the context is no longer usable and must not be referenced.
     * WARNING: This will not magically stop any running scripts (unless sandboxed).
     * You MUST make sure you properly clean up in the "suspend" and "destroy" handlers.
     */
    destroy(){
        if(this.destroyed || this.state === "destroyed") return;        
        if(this.state !== "suspended") this.emit("suspend");
        this.state = "destroyed";
        this.emit("destroy");

        for(const module of this.modules) {
            if(typeof module.destroy === "function") {
                // Destroy must not crash
                try {
                    module.destroy();
                } catch (e) {
                    console.error("Error destroying module:", e);
                }
            }
        }

        this.__previousParent = null;

        this.modules.clear();
        this.modules = null;

        // FIXME: Sandboxing needs to be better implemented

        this.state = "destroyed";
        this.logContext.destroy();
        this.logContext = null;

        this.content?.remove();
        this.content = null;
        kernel.contexts.delete(this.id);
        kernel.quickEmit("context-destroyed");
        kernel.pageCache.delete(this.#path);

        if(kernel.viewport.current === this) {
            kernel.viewport.current = null;
        }

        for(const pattern of this.SPAPatterns) {
            kernel.SPAExtensions.remove(pattern, this);
        }

        if(this.aliases) for(const alias of this.aliases) {
            kernel.aliasMap.delete(alias);
        }

        this.loadPromise = null;
        this.SPAPatterns = null;

        // Unload assets that are not used elsewhere
        for (const style of this.styles || []) {
            let stillUsed = false;
            for (const ctx of kernel.contexts.values()) {
                if (ctx !== this && ctx.styles && ctx.styles.includes(style)) {
                    stillUsed = true;
                    break;
                }
            }
            if (!stillUsed) AssetManager.remove(style);
        }

        for (const script of this.scripts || []) {
            let stillUsed = false;
            for (const ctx of kernel.contexts.values()) {
                if (ctx !== this && ctx.scripts && ctx.scripts.includes(script)) {
                    stillUsed = true;
                    break;
                }
            }
            if (!stillUsed) AssetManager.remove(script);
        }

        this.scripts = null;
        this.styles = null;
        this.content = null;
        this.error = null;

        if(this.logContext) {
            this.log("Context destroyed");
            this.logContext.destroy();
            this.logContext = null;
        }

        // Clears the rest of the context including events
        super.destroy();
    }
}


/**
 * Viewport class
 * Represents a viewport in the application where content contexts can be rendered.
 */
let firstPage = true;
class Viewport extends LS.EventEmitter {
    constructor(name, element, options = {}) {
        super();
        this.name = name || "default";
        this.target = element;
        this.current = null;
        this.history = [];
        this.options = options;
        this.target.classList.add("viewport");
        this.target.viewportInstance = this;
        this.destroyed = false;

        // Kernel may not be initilaized yet, that's why we allow a fallback
        (options.kernel || kernel).viewports.set(this.name, this);
    }

    get errorPageElement() {
        return this.__errorPage || (this.__errorPage = LS.Create({
            class: 'error_page',
            inner: [
                (this.errorPageStatus = LS.Create({ tag: "h1" })),
                { class: 'marqueeBar', inner: [[
                    (this.errorPageMessage1 = { tag: 'span', textContent: 'Unexpected error.' }),
                    (this.errorPageMessage2 = { tag: 'span', textContent: 'Unexpected error.' }),
                ]]},
                { tag: 'br' },
                { tag: 'br' },
                { tag: 'a', href: '/', textContent: 'Go back home?' }
            ]
        }));
    }

    /**
     * Navigate to a new content context
     * @param {*} pathOrPage The content context to navigate to
     * @param {*} options Navigation options
     */
    async navigate(pathOrPage, options = {}) {
        let path = typeof pathOrPage === 'string' ? pathOrPage : pathOrPage.path;
        let page = pathOrPage instanceof ContentContext ? pathOrPage : null;
        let hash = typeof options.hash === "string" ? options.hash : "";

        if(typeof hash === "string" && hash.length > 0) {
            if(!hash.startsWith("#")) hash = "#" + hash;
            if(hash === "#") hash = "";
        }

        if (typeof path === "string") {
            const hashIndex = path.indexOf("#");
            if (hashIndex !== -1) {
                hash = path.slice(hashIndex);
                if(hash === "#") hash = "";
                path = path.slice(0, hashIndex) || "/";
            }
        }

        if(this.options.disableRemotePages && (!page || page.src)) {
            kernel.error("Remote pages are disabled for this viewport (" + this.name + ").");
            return false;
        }

        // Normalize path
        if (typeof path === "string") {
            path = LS.Util.normalizePath(path);
        }

        // 0. Open app from route (/app/<app-id>)
        if (!page && typeof path === "string" && path.startsWith("/app/")) {
            const appId = decodeURIComponent(path.slice(5).split("/")[0] || "").trim();
            if (!appId) return false;

            try {
                await new Promise((resolve, reject) => {
                    kernel.openApplication(appId, {
                        ...options,
                        windowOptions: {
                            ...(options.windowOptions || {}),
                            disableOpenAnimation: true
                        },
                        source: options.source || "route-app"
                    }).done((instance) => {
                        instance?.window?.maximize(true);
                        resolve(instance);
                    }).catch(reject);
                });

                const manifest = kernel.appManifests.get(appId);
                if (this.name === 'main') {
                    const historyPath = path + (hash || "");
                    if (!options.browserTriggered && options.pushState !== false && (location.pathname + location.hash) !== historyPath) {
                        history.pushState({ path: historyPath }, document.title, historyPath);
                    }
                    document.title = `LSTV | ${manifest?.name || appId}`;
                    app.desktop.closeToolbar();
                }

                kernel.log(`Opened app ${appId} from route ${path}`);
                return true;
            } catch (e) {
                kernel.error("Failed to open app route:", path, e);
                LS.Toast.show("Failed to open app.", { accent: "red" });
                return false;
            }
        }

        // 1. Check for SPA Extensions (Routes)
        const SPAExtension = options.browserTriggered? null: kernel.resolveSPAExtension(path);
        if (SPAExtension) {
            if (SPAExtension[2] !== this.current) {
                // We need to navigate to the base page first
                await this.navigate(SPAExtension[2], { browserTriggered: true });
            }

            const historyPath = path + (hash || "");
            if((location.pathname + location.hash) !== historyPath && !options.browserTriggered && options.pushState !== false && this.name === 'main') {
                history.pushState({ path: historyPath }, document.title, historyPath);
            }
            kernel.handleSPAExtension(path, SPAExtension, options.targetElement || null);
            if(hash) {
                requestAnimationFrame(() => {
                    this.navigateToHash(hash);
                });
            }
            return true;
        }

        // 2. Resolve Page Object
        if (!page) {
            page = kernel.getPage(path);
            if (!page) {
                // Dynamic Load
                kernel.log("Dynamically loading page for", path);
                page = kernel.registerPage(path, {
                    src: location.origin + path,
                    // Inherit sandbox options if provided in navigation options
                    sandboxMode: options.sandbox || options.sandboxMode || null
                });
            }
        }

        if (!page) {
            kernel.error("Failed to resolve page for", path);
            return false;
        }

        const old = this.current;

        if (old === page && !options.reload && !page.requiresReload) {
            if(hash) {
                if(this.name === "main" && !options.browserTriggered && !options.initial) {
                    const historyPath = page.path + hash;
                    if((location.pathname + location.hash) !== historyPath) {
                        history.pushState({ path: historyPath }, document.title, historyPath);
                    }
                }

                requestAnimationFrame(() => {
                    this.navigateToHash(hash);
                });
            }
            return true;
        }

        // Suspend old page
        if (old) old.suspend();

        this.target.classList.add("loading");
        this.target.setAttribute("state", "loading");

        // Ensure to render the loading indicator; we don't know how long loading will take or if something explodes
        await (new Promise(resolve => requestAnimationFrame(resolve)));

        // Load and Render new page
        try {
            if (!page.error) {
                await page.render(this.target);
            }

            if(page.error) {
                this.errorPage(page.error);
            } else {
                this.emit("rendered", page);

                if(this.name === "main" && !firstPage) page.content.animate([{ opacity: .5, transform: "scale(102%)" }, { opacity: 1, transform: "scale(100%)" }], { duration: 300, easing: "ease" });
                firstPage = false;
            }

            this.current = page;

            if (this.name === 'main') {
                document.title = page.title || "LSTV | Untitled";//(page.title && page.title.startsWith("LSTV | "))? page.title: `LSTV | ${page.title || 'Untitled'}`;
                
                if (!options.browserTriggered && !options.initial) {
                    const historyPath = page.path + (hash || "");
                    if((location.pathname + location.hash) !== historyPath) {
                        history.pushState({ path: historyPath }, document.title, historyPath);
                    }
                }
                app.desktop.closeToolbar();
            }

            if(hash) {
                requestAnimationFrame(() => {
                    this.navigateToHash(hash);
                });
            }

            kernel.log(`Navigated to ${path} in ${this.name}`);
            return true;
        } catch (e) {
            kernel.error("Navigation failed:", e);

            // Handle network errors specifically
            if (e.message && (e.message.includes("fetch") || e.message.includes("Network") || e instanceof TypeError)) {
                LS.Modal.buildEphemeral({
                    title: [{ tag: "i", class: "bi-wifi-off" }, " Could not load page"],
                    content: "We're sorry, but something seems to have gone wrong while trying to navigate to the site you were trying to get to. Make sure you are connected to the internet!",
                    buttons: [
                        { label: "Try again" },
                        { label: "Go back" }
                    ]
                }, { closeable: false }).open();
                return false;
            }

            // Restore old page
            // if (old && !old.destroyed) {
            //     try {
            //         await old.render(this.target);
            //     } catch (restoreError) {
            //         // Could be dead or something
            //         kernel.error("Failed to restore previous page:", restoreError);
            //         this.errorPage(500);
            //     }
            // } else {
            // }
            this.errorPage(page.error || 500);
            return false;
        } finally {
            this.target.classList.remove("loading");
            this.target.setAttribute("state", "idle");
        }
    }

    errorPage(status) {
        this.errorPageElement; // Ensure it's created

        this.errorPageStatus.textContent = String(status);
        this.errorPageMessage1.textContent = app.errorMessages[status] || 'Unexpected error.';
        this.errorPageMessage2.textContent = this.errorPageMessage1.textContent;
        this.target.replaceChildren(this.errorPageElement);
    }

    navigateToHash(hash) {
        if(typeof hash !== "string" || !hash || hash === "#") return false;

        let id = hash.startsWith("#") ? hash.slice(1) : hash;
        if(!id) return false;

        try {
            id = decodeURIComponent(id);
        } catch (e) {}

        const element = document.getElementById(id) || document.getElementsByName(id)?.[0] || null;
        if(!element) return false;

        element.scrollIntoView({ block: "start" });
        return true;
    }

    destroy(destroyContent = false) {
        if (this.destroyed) return;
        this.destroyed = true;

        if (destroyContent && this.current) {
            this.current.destroy();
        }
        this.current = null;

        if(this.__errorPage) {
            this.__errorPage.remove();
            this.__errorPage = null;
            this.errorPageStatus = null;
            this.errorPageMessage1 = null;
            this.errorPageMessage2 = null;
        }

        this.history = [];
        this.history = null;

        if(this.target.viewportInstance === this) {
            delete this.target.viewportInstance;
        }

        this.target.remove();
        this.target = null;

        kernel.viewports.delete(this.name);
        this.options = null;
    }
}


/**
 * Thread class
 * Used to summon separate threads (web-workers). You can think of it as "processes", managed by the kernel.
 * They offer isolated execution environments for apps & execution control.
 */
class Thread extends LS.EventEmitter {
    constructor(scriptURL, options = {}) {
        super();

        this.scriptURL = scriptURL;
        this.options = options;

        this.destroyed = false;
        this.worker = new Worker(scriptURL, options);

        // API to be worked on
        this.worker.onmessage = (event) => {
            const data = event.data;
            this.emit("message", [data]);
        }

        kernel.threads.add(this);
    }

    static fromJavaScript(code, options = {}) {
        const blob = new Blob([code], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const thread = new Thread(url, options);
        URL.revokeObjectURL(url);
        return thread;
    }

    postMessage(data) {
        if(!this.destroyed) this.worker.postMessage(data);
    }

    terminate() {
        if(this.destroyed) return;
        this.emit("terminate");
        this.worker.onmessage = null;
        this.worker.onerror = null;
        this.worker.terminate();
        kernel.threads.delete(this);
        this.events.clear();
        this.worker = null;
        this.destroyed = true;
        this.options = null;
        this.scriptURL = null;
    }
}

/**
 * Linux enums.
 */

class Enums  {
    /**
     * @see https://man7.org/linux/man-pages/man2/open.2.html
     * @see https://sites.uclouvain.be/SystInfo/usr/include/bits/fcntl.h.html
     */
    static O_ACCMODE  = 0o0003; // access mode mask

    static O_RDONLY   = 0o0000; // open for reading only
    static O_WRONLY   = 0o0001; // open for writing only
    static O_RDWR     = 0o0002; // open for reading and writing

    static O_CREAT    = 0o0100; // create file if it does not exist
    static O_EXCL     = 0o0200; // exclusive creation
    static O_NOCTTY   = 0o0400; // do not assign controlling terminal
    static O_TRUNC    = 0o1000; // truncate file to zero length
    static O_APPEND   = 0o2000; // append on each write
    static O_NONBLOCK = 0o4000; // non-blocking mode
    static O_NDELAY   = 0o4000; // non-blocking mode (same as O_NONBLOCK)
    static O_SYNC     = 0o10000; // synchronous writes
    static O_FSYNC    = 0o10000; // synchronous writes (same as O_SYNC)
    static O_ASYNC    = 0o20000; // asynchronous I/O

    static S_IFMT   = 0o170000; /* type mask */

    static S_IFSOCK = 0o140000; /* socket */
    static S_IFLNK  = 0o120000; /* symbolic link */
    static S_IFREG  = 0o100000; /* regular file */
    static S_IFIFO  = 0o010000; /* FIFO */
    static S_IFCHR  = 0o020000; /* character device */
    static S_IFDIR  = 0o040000; /* directory */
    static S_IFBLK  = 0o060000; /* block device */

    static PERMS = 0o07777;

    // --- Non-standard flags specific to Linux.js only
    static XO_STATONLY = 0x0001;

    /**
     * @see https://man7.org/linux/man-pages/man3/errno.3.html
     */
    static errno = {
        EPERM: 0x01, // Operation not permitted
        ENOENT: 0x02, // No such file or directory
        ESRCH: 0x03, // No such process
        EINTR: 0x04, // Interrupted system call
        EIO: 0x05, // Input/output error
        ENXIO: 0x06, // No such device or address
        E2BIG: 0x07, // Argument list too long
        ENOEXEC: 0x08, // Exec format error
        EBADF: 0x09, // Bad file descriptor
        ECHILD: 0x0a, // No child processes
        EAGAIN: 0x0b, // Resource temporarily unavailable
        EWOULDBLOCK: 0x0b, // (Same value as EAGAIN) Resource temporarily unavailable
        ENOMEM: 0x0c, // Cannot allocate memory
        EACCES: 0x0d, // Permission denied
        EFAULT: 0x0e, // Bad address
        ENOTBLK: 0x0f, // Block device required
        EBUSY: 0x10, // Device or resource busy
        EEXIST: 0x11, // File exists
        EXDEV: 0x12, // Invalid cross-device link
        ENODEV: 0x13, // No such device
        ENOTDIR: 0x14, // Not a directory
        EISDIR: 0x15, // Is a directory
        EINVAL: 0x16, // Invalid argument
        ENFILE: 0x17, // Too many open files in system
        EMFILE: 0x18, // Too many open files
        ENOTTY: 0x19, // Inappropriate ioctl for device
        ETXTBSY: 0x1a, // Text file busy
        EFBIG: 0x1b, // File too large
        ENOSPC: 0x1c, // No space left on device
        ESPIPE: 0x1d, // Illegal seek
        EROFS: 0x1e, // Read-only file system
        EMLINK: 0x1f, // Too many links
        EPIPE: 0x20, // Broken pipe
        EDOM: 0x21, // Numerical argument out of domain
        ERANGE: 0x22, // Numerical result out of range
        EDEADLK: 0x23, // Resource deadlock avoided
        EDEADLOCK: 0x23, // (Same value as EDEADLK) Resource deadlock avoided
        ENAMETOOLONG: 0x24, // File name too long
        ENOLCK: 0x25, // No locks available
        ENOSYS: 0x26, // Function not implemented
        ENOTEMPTY: 0x27, // Directory not empty
        ELOOP: 0x28, // Too many levels of symbolic links

        ENOMSG: 0x2a, // No message of desired type
        EIDRM: 0x2b, // Identifier removed
        ECHRNG: 0x2c, // Channel number out of range
        EL2NSYNC: 0x2d, // Level 2 not synchronized
        EL3HLT: 0x2e, // Level 3 halted
        EL3RST: 0x2f, // Level 3 reset
        ELNRNG: 0x30, // Link number out of range
        EUNATCH: 0x31, // Protocol driver not attached
        ENOCSI: 0x32, // No CSI structure available
        EL2HLT: 0x33, // Level 2 halted
        EBADE: 0x34, // Invalid exchange
        EBADR: 0x35, // Invalid request descriptor
        EXFULL: 0x36, // Exchange full
        ENOANO: 0x37, // No anode
        EBADRQC: 0x38, // Invalid request code
        EBADSLT: 0x39, // Invalid slot

        EBFONT: 0x3b, // Bad font file format
        ENOSTR: 0x3c, // Device not a stream
        ENODATA: 0x3d, // No data available
        ETIME: 0x3e, // Timer expired
        ENOSR: 0x3f, // Out of streams resources
        ENONET: 0x40, // Machine is not on the network
        ENOPKG: 0x41, // Package not installed
        EREMOTE: 0x42, // Object is remote
        ENOLINK: 0x43, // Link has been severed
        EADV: 0x44, // Advertise error
        ESRMNT: 0x45, // Srmount error
        ECOMM: 0x46, // Communication error on send
        EPROTO: 0x47, // Protocol error
        EMULTIHOP: 0x48, // Multihop attempted
        EDOTDOT: 0x49, // RFS specific error
        EBADMSG: 0x4a, // Bad message
        EOVERFLOW: 0x4b, // Value too large for defined data type
        ENOTUNIQ: 0x4c, // Name not unique on network
        EBADFD: 0x4d, // File descriptor in bad state
        EREMCHG: 0x4e, // Remote address changed
        ELIBACC: 0x4f, // Can not access a needed shared library
        ELIBBAD: 0x50, // Accessing a corrupted shared library
        ELIBSCN: 0x51, // .lib section in a.out corrupted
        ELIBMAX: 0x52, // Attempting to link in too many shared libraries
        ELIBEXEC: 0x53, // Cannot exec a shared library directly
        EILSEQ: 0x54, // Invalid or incomplete multibyte or wide character
        ERESTART: 0x55, // Interrupted system call should be restarted
        ESTRPIPE: 0x56, // Streams pipe error
        EUSERS: 0x57, // Too many users
        ENOTSOCK: 0x58, // Socket operation on non-socket
        EDESTADDRREQ: 0x59, // Destination address required
        EMSGSIZE: 0x5a, // Message too long
        EPROTOTYPE: 0x5b, // Protocol wrong type for socket
        ENOPROTOOPT: 0x5c, // Protocol not available
        EPROTONOSUPPORT: 0x5d, // Protocol not supported
        ESOCKTNOSUPPORT: 0x5e, // Socket type not supported
        EOPNOTSUPP: 0x5f, // Operation not supported
        ENOTSUP: 0x5f, // (Same value as EOPNOTSUPP) Operation not supported
        EPFNOSUPPORT: 0x60, // Protocol family not supported
        EAFNOSUPPORT: 0x61, // Address family not supported by protocol
        EADDRINUSE: 0x62, // Address already in use
        EADDRNOTAVAIL: 0x63, // Cannot assign requested address
        ENETDOWN: 0x64, // Network is down
        ENETUNREACH: 0x65, // Network is unreachable
        ENETRESET: 0x66, // Network dropped connection on reset
        ECONNABORTED: 0x67, // Software caused connection abort
        ECONNRESET: 0x68, // Connection reset by peer
        ENOBUFS: 0x69, // No buffer space available
        EISCONN: 0x6a, // Transport endpoint is already connected
        ENOTCONN: 0x6b, // Transport endpoint is not connected
        ESHUTDOWN: 0x6c, // Cannot send after transport endpoint shutdown
        ETOOMANYREFS: 0x6d, // Too many references: cannot splice
        ETIMEDOUT: 0x6e, // Connection timed out
        ECONNREFUSED: 0x6f, // Connection refused
        EHOSTDOWN: 0x70, // Host is down
        EHOSTUNREACH: 0x71, // No route to host
        EALREADY: 0x72, // Operation already in progress
        EINPROGRESS: 0x73, // Operation now in progress
        ESTALE: 0x74, // Stale file handle
        EUCLEAN: 0x75, // Structure needs cleaning
        ENOTNAM: 0x76, // Not a XENIX named type file
        ENAVAIL: 0x77, // No XENIX semaphores available
        EISNAM: 0x78, // Is a named type file
        EREMOTEIO: 0x79, // Remote I/O error
        EDQUOT: 0x7a, // Disk quota exceeded
        ENOMEDIUM: 0x7b, // No medium found
        EMEDIUMTYPE: 0x7c, // Wrong medium type
        ECANCELED: 0x7d, // Operation canceled
        ENOKEY: 0x7e, // Required key not available
        EKEYEXPIRED: 0x7f, // Key has expired
        EKEYREVOKED: 0x80, // Key has been revoked
        EKEYREJECTED: 0x81, // Key was rejected by service
        EOWNERDEAD: 0x82, // Owner died
        ENOTRECOVERABLE: 0x83, // State not recoverable
        ERFKILL: 0x84, // Operation not possible due to RF-kill
        EHWPOISON: 0x85, // Memory page has hardware error
    };

    static __errCache;
    static errCode(code) {
        if(!this.__errCache) {
            this.__errCache = new Map(Object.entries(this.errno).map(v => v.reverse()));
        }
        return this.__errCache.get(code);
    }
}

// WARNING: The following imports are just a stub, the actual build system is being worked on.

/**
 * SoundBox class
 * It is used for playing system sound effects and other simple audio with user-overridable sound packs.
 * A revamped version of my old jukebox.js mini-library.
 * 
 * This functions separetely from the global media player.
 * 
 * @param {Object} options - The options for the SoundBox.
 * @param {number} options.volume - The global volume of the SoundBox.
 * @param {SoundBox} parent - Optional parent SoundBox. Will inherit the sound map but have its own volume and threads for context isolation.
 * @param {string} nameScope - Optional scope for sound names to also isolate created sounds under a namespace.
 */
class SoundBox {
    constructor(options = {}, parent = null, nameScope = null) {
        this.parent = parent;
        this.nameScope = nameScope;

        this.ctx =      parent? parent.ctx: new (window.AudioContext || window.webkitAudioContext)();
        this.soundMap = parent? parent.soundMap: new Map();
        this.threads =  new Set();

        // Global gain node for controlling volume of all sounds played through this SoundBox
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);

        this.setVolume(options.volume ?? 1);

        if(options.sounds) {
            this.registerMany(options.sounds);
        }
    }

    /**
     * Sets the volume of all sounds played through this SoundBox.
     * @param {number} volume The volume to set, between 0 and 1.
     */
    setVolume(volume = 1) {
        this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }

    get volume() {
        return this.gainNode.gain.value;
    }

    set volume(value) {
        this.setVolume(value);
    }

    /**
     * Creates a new sound thread. Loads the sound if it is not already loaded.
     * @param {*} soundName The name of the sound to play. Must be registered first.
     * @param {*} options Options for the sound thread. Can include volume, loop, playbackRate, etc.
     * @returns {Promise<SoundBoxThread>} A promise that resolves to a SoundBoxThread instance.
     */
    async createThread(soundName, options = {}) {
        let sound = this.soundMap.get(soundName);
        if(!sound) {
            kernel.error("Sound not found:", soundName);
            return null;
        }

        if(!sound.buffer) {
            await this.load(soundName);
            if(!sound.buffer) {
                return;
            }
        }

        const thread = new SoundBoxThread(this, sound, options);
        return thread;
    }

    /**
     * Helper that plays a sound by creating a thread and starting it. It will load the sound if it is not already loaded.
     * @param {*} soundName The name of the sound to play. Must be registered first.
     * @param {*} options Options for the sound thread. Can include volume, loop, playbackRate, etc.
     * @returns {Promise<void>} A promise that resolves when the sound is played.
     */
    async play(soundName, options = {}) {
        options ??= {};
        options.ephemeral ??= true;
        options.autoPlay  ??= true;

        const thread = await this.createThread(soundName, options);
        if(!thread) {
            kernel.error("Failed to create sound thread for:", soundName);
            return;
        }
        return thread;
    }

    /**
     * Registers a sound with the SoundBox.
     * @param {*} soundName The name of the sound to register.
     * @param {*} options Options for the sound. Can include src (URL), volume, loop, etc.
     */
    register(soundName, options) {
        if(!soundName || typeof soundName !== "string") {
            kernel.error("Sound name must be a non-empty string.");
            return;
        }

        if(this.nameScope) {
            soundName = `${this.nameScope}:${soundName}`;
        }

        if(this.soundMap.has(soundName)) {
            kernel.warn("Sound already registered:", soundName);
            return;
        }

        if(typeof options === "string") {
            options = { src: options };
        }

        this.soundMap.set(soundName, options);
    }

    update(soundName, options) {
        if(this.nameScope) {
            soundName = `${this.nameScope}:${soundName}`;
        }

        const existingOptions = this.soundMap.get(soundName);
        if(!existingOptions) {
            kernel.warn("Sound not registered:", soundName);
            return;
        }

        Object.assign(existingOptions, options);
    }

    /**
     * Registers multiple sounds at once.
     * @param {Object} sounds - An object where keys are sound names and values are options.
     */
    registerMany(sounds) {
        for(const [soundName, options] of Object.entries(sounds)) {
            this.register(soundName, options);
        }
    }

    unregister(soundName) {
        if(this.nameScope) {
            soundName = `${this.nameScope}:${soundName}`;
        }

        if(!this.soundMap.has(soundName)) {
            kernel.warn("Sound not registered:", soundName);
            return;
        }

        this.soundMap.delete(soundName);
    }

    /**
     * Unregisters multiple sounds at once.
     * @param {string[]} soundNames - An array of sound names to unregister.
     */
    unregisterMany(soundNames) {
        for(const soundName of soundNames) {
            this.unregister(soundName);
        }
    }

    /**
     * Loads a sound into the SoundBox. If the sound is already loaded, it will not reload it.
     * @param {*} soundName The name of the sound to load.
     * @returns {Promise<boolean>} Returns true if the sound is playable, false if something went wrong.
     */
    async load(soundName, fallbackIndex = -1) {
        const sound = this.soundMap.get(soundName);

        if(!sound) {
            kernel.error("Sound not found:", soundName);
            return false;
        }

        if(sound.buffer && sound.__lastSrc === sound.src) return true;

        try {
            const src = fallbackIndex < 0? sound.src: (this.soundMap.get(sound.fallback[fallbackIndex])?.src);
            if(!src) throw "No available source";

            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            sound.buffer = await this.ctx.decodeAudioData(arrayBuffer);
            sound.__lastSrc = src;
            return true;
        } catch (e) {
            if(Array.isArray(sound.fallback) && sound.fallback.length > (fallbackIndex + 1)) {
                fallbackIndex ++;
                kernel.error("Failed to load sound:", soundName, ", trying to fallback to next alternative: ", sound.fallback[fallbackIndex], e);
                return await this.load(soundName, fallbackIndex);
            }

            kernel.error("Failed to load sound:", soundName, e);
            return false;
        }
    }

    async loadAll() {
        const loadPromises = [];
        for(const [soundName, sound] of this.soundMap.entries()) {
            loadPromises.push(this.load(soundName));
        }
        await Promise.all(loadPromises);
    }

    stopAll(id = null) {
        for(const thread of this.threads) {
            if(id === null || thread.userId === id) {
                thread.terminate();
            }
        }
        this.threads.clear();
    }

    pauseAll(id = null) {
        for(const thread of this.threads) {
            if(id === null || thread.userId === id) {
                thread.pause();
            }
        }
    }

    resumeAll(id = null) {
        for(const thread of this.threads) {
            if(id === null || thread.userId === id) {
                thread.resume();
            }
        }
    }

    destroy() {
        if(this.destroyed) return;
        this.destroyed = true;

        this.stopAll();

        this.soundMap.clear();
        this.soundMap = null;

        if(this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}

/**
 * SoundBoxThread class
 * Represents a single sound thread that can be played, stopped, and controlled.
 * 
 * This class has no awareness of loading or managing media, it simply provides an interface for controlling an existing sound buffer.
 */
class SoundBoxThread {
    constructor(parent, sound, options = {}) {
        if(!(parent instanceof SoundBox) || !sound) {
            throw new Error("SoundBoxThread requires a parent SoundBox and a source.");
        }

        this.parent  = parent;
        this.sound   = sound;
        this.options = options ?? {};
        this.parent.threads.add(this);

        this.created = false;
        this.source  = null;
        this.destroyed = false;

        this._speed = this.options.speed ?? 1;
        this._loop = this.options.loop   ?? false;
        this.volume = this.options.volume ?? 1;

        this.userId = this.options.userId ?? null;

        // this.span = [0, -1];

        if(this.options.autoPlay) {
            this.play();
        } else if(this.options.autoCreate) {
            this.create();
        }
    }

    /**
     * Creates (or reloads) the audio context for the sound thread.
     */
    create() {
        if(this.destroyed) {
            throw new Error("Cannot initialize a destroyed SoundBoxThread.");
        }

        this.disposeSource();
        this.source = this.parent.ctx.createBufferSource();
        this.source.buffer = this.sound.buffer;

        this.source.connect(this.outputNode);

        this.loop = this._loop;
        this.speed = this._speed;

        this.created = true;
    }

    /**
     * Plays the sound thread from a specific offset and for a specific duration.
     * Can be called multiple times to play the sound again.
     * @param {number} offset - The offset in seconds to start playing from.
     * @param {number} duration - The duration in seconds to play. If negative, plays the entire sound.
     */
    play(offset = 0, duration = -1) {
        if(this.destroyed) {
            throw new Error("Cannot play a destroyed SoundBoxThread.");
        }

        // Sadly the API was desgined by a r*tard so we have to recreate the source every time we play a sound.
        // if(!this.created) this.create();
        this.create();

        if(duration < 0) {
            duration = this.duration;
        }

        this.source.start(0, offset, duration);

        this.completedPromise().then(() => {
            if(this.options.ephemeral) {
                // Terminate & delete the thread after the sound has finished playing.
                this.terminate();
            } else {
                // We could reuse the node but we can't.
                this.source.disconnect();
                this.source = null;
            }
        });
    }

    completedPromise() {
        if(!this.source) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.source.onended = () => {
                resolve();
            };
        });
    }

    get duration() {
        if(!this.source) {
            return 0;
        }
        return this.source.buffer?.duration || 0;
    }

    get volume() {
        return this.gainNode?.gain.value ?? 1;
    }

    set volume(value) {
        value = Math.max(0, Math.min(1, value ?? 1));

        if(this.gainNode) {
            this.gainNode.gain.value = value;
            return;
        }

        if(value === 1) {
            // We can skip creating a gain node if the volume is 1.
            this.gainNode = null;
            this.outputNode = this.parent.gainNode;
            return;
        }

        this.gainNode = this.parent.ctx.createGain();
        this.gainNode.gain.value = value;
        this.gainNode.connect(this.parent.gainNode);
        this.outputNode = this.gainNode;
    }

    get loop() {
        return this._loop;
    }

    set loop(value) {
        this._loop = !!value;
        if(this.source) {
            this.source.loop = this._loop;
        }
    }

    get speed() {
        return this._speed;
    }

    set speed(value) {
        if(!this.source) return;
        this.source.playbackRate.value = value;
        this._speed = this.source.playbackRate.value;
    }

    pause() {
        if(!this.source) return;
        this.source.playbackRate.value = 0;
    }

    resume() {
        if(!this.source) return;
        this.source.playbackRate.value = this._speed;
    }

    stop() {
        if(!this.source) return;
        try {
            this.source.stop();
        } catch (e) {
            console.error("Error stopping audio source:", e);
        }
    }

    disposeSource() {
        this.stop();
        if(this.source) {
            this.source.disconnect();
            this.source = null;
        }
    }

    terminate() {
        this.disposeSource();
        if(this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        this.parent.threads.delete(this);
        this.parent = null;
        this.sound = null;
        this.options = null;
        this.created = false;
        this.source = null;
        this.outputNode = null;
        this.destroyed = true;
    }
}

// WARNING: The following imports are just a stub, the actual build system is being worked on.

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

// WARNING: The following imports are just a stub, the actual build system is being worked on.
// import { SoundBox } from "./soundbox.mjs";
// import { LiDesktop, MediaPlayer } from "./desktop.mjs";
// import { LoggerContext, AssetManager, ContentContext, Viewport, Thread } from "./commons.mjs";
// import { app } from "./shared.mjs";
// import { kernel } from "./kernel.mjs";

/**
 * Performant & full-featured filesystem abstraction for Linux.JS 2.0/lstv.space kernel.
 * @copyright admin@lstv.space
 * 
 * This is a Linux-like filesystem abstraction that aims to replicate the behavior of a typical Linux filesystem.
 * It is a part of a larger project which aims to bring a lightweight Linux environment to the web, but can be used standalone to get a FS API.
 * It comes with it's own optimized filesystem and path utilities.
 * 
 * 
 * Supports Linux-compatible enums, permissions, symlinks, sockets, etc. and a rich selection of various backends.
 * Currently supported backends:
 * - TmpFs: Very fast in-memory storage. All features supported. Likely as light as an in-memory fs can get.
 * - IndexedDbFs: Persistent browser storage via IndexedDB. Note: hardlink support is wip.
 * - MemFs: In-memory archive format storage (supports compression, patching, fast state backup/restore, and instantly mounting a system image without touching any physical files with near-zero memory cost, good for temporary environments.) Note: hardlink support is wip.
 * - LocalStorageFs: LocalStorage/SessionStorage-backed storage. Note: hardlink support is wip.
 * - NodeFs: Host filesystem passthrough for virtually any native filesystem (Node.js only)
 * - RemoteFs: Remote connection via network to another instance (ws/http)
 * - WasmXFs: (Work in progress), virtual low-level filesystem inspired by XFS specifically for WASM applications.
 * - Other backends are very possible too. Perhaps the new browser file API could be supported.
 * 
 * Misc backends:
 * - JSFS: Mounts any JavaScript/JSON object as a (readonly) filesystem. Not sure about the use of this but you will find something.
 * - NullFs: Storage that sends all your writes to the void. Simple as that.
 * - jszfs: Read-only FS compatible with the old Linux.JS 1.0 virtual filesystem.
 * 
 * @example
 * const rootFs = new RootFs();
 * 
 * // Mount something as the root
 * rootFs.mount("/", new TmpFs({ data: TmpFs.basicLinuxFs() }));
 * 
 * console.log("Root directory: ", await rootFs.stat("/"));
 * 
 * const fd = await rootFs.open("/etc/os-release", Enums.O_RDONLY);
 * console.log(await rootFs.read(fd, 0, -1, RootFs.ENCODING.utf8));
 * fd.close();
 * 
 * const fd2 = await rootFs.open("/root/hello.txt", Enums.O_WRONLY | Enums.O_CREAT, Enums.S_IFREG | 0o644);
 * await rootFs.write(fd2, "Hello world");
 * fd2.close();
 * 
 * // Higher-level APIs are also available for easier use.
 * console.log(await rootFs.readFile(RootFs.join("/root", "hello.txt"), "utf8"));
 * 
 * // & of course cleanup is quite simple.
 * // For TmpFs/MemFs only: delete everything in the memory cache instantly.
 * rootFs.destroyStateAtMount("/");
 * rootFs.unmount("/");
 * rootFs.destroy(); // This also unmounts everything.
 * 
 * // There are also some filesystem-dependent extra non-standard flags.
 * // They are separated from regular flags, but can enhance performance, such as Enums.XO_STATONLY which avoids opening a fd when fetching stats of a file or Enums.XO_JS_STRING that can work directly with cached JS strings in some filesystems to avoid encoding/decoding.
 * // Usually RootFs decides those automatically so you should avoid using them directly unless you know they are suported and won't break access.
 */

/**
 * File stats object
 */
class Stats {
    mode = Enums.S_IFREG | 0o644;

    uid = 0; // File owner
    gid = 0; // File group

    atimeMs = 0;     // Last time the file was accessed
    mtimeMs = 0;     // Last time the file was modified
    ctimeMs = 0;     // Last time the file was either created or its metadata were modified (usually the creation date)
    birthtimeMs = 0; // Time the date was actually created (not always supported).

    size = -1;       // Size in bytes
    blocks = -1;     // Number of blocks allocated
    blksize = -1;    // FS Block size
    ino = -1;        // Inode number

    dev = 0;         // Device the file is stored on
    rdev = 0;        // Device identifier if the file is a device
    nlink = 1;       // Number of hard links to this file

    constructor(mode) {
        this.mode = mode;
    }

    static typeOf(mode) {
        return mode & Enums.S_IFMT;
    }

    get type() {
        return this.mode & Enums.S_IFMT;
    }

    get isFile() {
        return this.type === Enums.S_IFREG;
    }

    get isDirectory() {
        return this.type === Enums.S_IFDIR;
    }

    get isSymlink() {
        return this.type === Enums.S_IFLNK;
    }

    get isBlockDevice() {
        return this.type === Enums.S_IFBLK;
    }

    get isCharacterDevice() {
        return this.type === Enums.S_IFCHR;
    }

    get isFIFO() {
        return this.type === Enums.S_IFIFO;
    }

    get isSocket() {
        return this.type === Enums.S_IFSOCK;
    }

    get permissions() {
        // todo: check if this is valid
        return this.mode & Enums.PERMS;
    }

    getPerms() {
        const mode = this.mode;
        return {
            owner: {
                read:  !!(mode & 0o400),
                write: !!(mode & 0o200),
                exec:  !!(mode & 0o100),
            },
            group: {
                read:  !!(mode & 0o040),
                write: !!(mode & 0o020),
                exec:  !!(mode & 0o010),
            },
            other: {
                read:  !!(mode & 0o004),
                write: !!(mode & 0o002),
                exec:  !!(mode & 0o001),
            },
        
            setuid:  !!(mode & 0o4000),
            setgid:  !!(mode & 0o2000),
            sticky:  !!(mode & 0o1000),
        }
    }
}

const DEFAULT_FS_DATA = [
    ["/", {}],
    ["/etc", {}],
    ["/etc/os-release", { contents: `NAME="LinuxJS"\nVERSION="2.0"\nID="linuxjs"\nVARIANT="lsw+lide-web"\nPRETTY_NAME="LinuxJS 2.0 (lstv.space, GNU/Linux)\nSUPPORT_END=2027-09-8"\nHOME_URL=https://lstv.space\nDEFAULT_HOSTNAME=linuxjs\nANSI_COLOR="0;38;2;60;110;180"\nLOGO=linuxjs-logo-icon`, mode: Enums.S_IFREG | 0o644 }],
    ["/etc/config.conf", { contents: "# Configuration file", mode: Enums.S_IFREG | 0o644 }],

    ["/usr", {}],
    ["/usr/bin", {}],
    ["/usr/sbin", {}],

    ["/usr/lib", {}],
    ["/usr/lib/os-release", { mode: Enums.S_IFLNK | 0o644, contents: "/etc/os-release" }],

    ["/usr/lib64", {}],

    ["/usr/share", {}],
    ["/usr/share/xsessions", {}],
    ["/usr/share/wayland-sessions", {}],
    ["/usr/share/lidm-web-sessions", {}],

    ["/bin",   { mode: Enums.S_IFLNK | 0o644, contents: "/usr/bin"   }],
    ["/sbin",  { mode: Enums.S_IFLNK | 0o644, contents: "/usr/sbin"  }],
    ["/lib",   { mode: Enums.S_IFLNK | 0o644, contents: "/usr/lib"   }],
    ["/lib64", { mode: Enums.S_IFLNK | 0o644, contents: "/usr/lib64" }],

    ["/var", {}],
    ["/var/log", {}],
    ["/var/tmp", {}],

    ["/tmp", {}],  // This will be overridden by a TmpFs mount
    ["/dev", {}],  // This will be overridden by a TmpFs mount
    ["/proc", {}], // This will be overridden by a ProcFs mount
    ["/sys", {}],  // This will be overridden by a SysFs mount
    ["/run", {}],  // This will be overridden by a SysFs mount
    ["/mnt", {}],  // This will be overridden by a TmpFs mount

    ["/media", {}],
    ["/opt", {}],
    ["/boot", {}],
    ["/root", {}],

    ["/home", {}],
    ["/home/user", {}],
    ["/home/user/Documents", {}],
    ["/home/user/Downloads", {}],
    ["/home/user/Pictures", {}],
    ["/home/user/Music", {}],
    ["/home/user/Videos", {}],
    ["/home/user/Desktop", {}],
    ["/home/user/.config", {}],
    ["/home/user/.local", {}],
    ["/home/user/.cache", {}],
    ["/home/user/.bashrc", { contents: "# Bash configuration file", mode: Enums.S_IFREG | 0o644 }],
    ["/home/user/.profile", { contents: "# User profile configuration file", mode: Enums.S_IFREG | 0o644 }],
    ["/home/user/.bash_history", { contents: "", mode: Enums.S_IFREG | 0o644 }],

    ["/root", {}],
    ["/root/.bashrc", { contents: "# Root Bash configuration file", mode: Enums.S_IFREG | 0o644 }],
    ["/root/.profile", { contents: "# Root user profile configuration file", mode: Enums.S_IFREG | 0o644 }],
    ["/root/.bash_history", { contents: "", mode: Enums.S_IFREG | 0o644 }],
];

/**
 * Root Filesystem base class.
 * This doesn't implement any actual storage, but provides the interface and common functionality for different types of filesystems.
 * It provides mounting, unmounting, higher-level operations for managing files and directories, error handling, and serves as a foundation for implementing filesystems.
 */
class RootFs {
    static ENCODING = {
        binary: 0,
        utf8: 1,
    }

    static PATH_SEPARATOR = "/";
    static PATH_SEPARATOR_CODE = 47;

    // --- Utility methods for path manipulation ---

    /**
     * Normalize a path to a canonical form. This is useful for resolving relative paths, removing redundant slashes, and ensuring consistent path formatting.
     * @param {string} path The path to normalize.
     * @param {boolean|null} isAbsolute Optional. If true, the returned path will be absolute (starting with /). If false, it will be relative. If null, it will be inferred from the input path.
     * @param {boolean} allowExit If true, relative paths can go outside of their directory. If false, they can't.
     * @param {boolean} returnParts If true, returns an array of path parts instead of a string.
     * @returns {string|Array<string>} The normalized path.
     * 
     * Also this implementation is 2x to 4x faster than the previous one in LinuxJS :P
     */
    static normalize(path, isAbsolute = null, allowExit = true, returnParts = false) {
        const parts = [];
        const len = path.length;

        const fc = path.charCodeAt(0);
        if (isAbsolute === null) isAbsolute = fc === this.PATH_SEPARATOR_CODE || fc === 92;
        
        if(len === 0) {
            return returnParts? parts: (isAbsolute? this.PATH_SEPARATOR: ".");
        }
        
        let cleanParts = 0;
        let sStart = 0, seqBroken = false;
        for (let i = 0; i < len; i++) {
            const char = path.charCodeAt(i);

            const isSeparator = char === this.PATH_SEPARATOR_CODE || char === 92;
            const isEnd = !isSeparator && (i === len - 1);

            if (isSeparator || isEnd) {
                if (isEnd) {
                    if (char !== 46) seqBroken = true;
                    i++;
                }

                const dCount = i - sStart;
                if (!seqBroken && (isAbsolute || !allowExit || dCount === 1 || cleanParts > 0)) {
                    // Go up ("..")
                    if(dCount === 2) {
                        parts.pop();
                        cleanParts--
                    }

                    // Otherwise do nothing
                } else if (dCount > 0) {
                    parts.push(path.slice(sStart, i));
                    if(seqBroken) cleanParts++;
                }

                sStart = i + 1;
                seqBroken = false;
                continue;
            }

            if (char !== 46) seqBroken = true;
        }

        if(returnParts) return parts;

        if(parts.length === 0) {
            return isAbsolute? this.PATH_SEPARATOR: ".";
        }

        const normalizedPath = parts.join('/');
        return isAbsolute ? '/' + normalizedPath : normalizedPath;
    }

    /**
     * Helper to normalize and split a path into segments.
     * Same as normalize(path, .., true);
     * @param {string} path Path to split.
     * @param {boolean|null} isAbsolute Same as normalize
     * @param {boolean} allowExit Same as normalize
     * @returns {Array<string>} Path segments as an array.
     */
    static splitPath(path, isAbsolute = null, allowExit = true) {
        return RootFs.normalize(path, isAbsolute, allowExit, true);
    }

    static basename(path) {
        const normalized = RootFs.normalize(path);
        const lastSepIndex = normalized.lastIndexOf(RootFs.PATH_SEPARATOR);
        if (lastSepIndex === -1) {
            return normalized;
        }
        return normalized.substring(lastSepIndex + 1);
    }

    static dirname(path) {
        const normalized = RootFs.normalize(path);
        const lastSepIndex = normalized.lastIndexOf(RootFs.PATH_SEPARATOR);
        if (lastSepIndex === -1) {
            return normalized;
        }
        return normalized.substring(0, lastSepIndex);
    }

    static ensureTrailing(npath, isAbsolute = null, normalize = true) {
        npath = RootFs.normalize(npath, isAbsolute);
        if (!npath.endsWith(RootFs.PATH_SEPARATOR)) {
            return npath + RootFs.PATH_SEPARATOR;
        }
        return npath;
    }

    /**
     * Move up x directory levels in a given path. Normalizes the path
     * @param {string} path Path
     * @param {number} [levels=1] How many levels to go up
     */
    static up(path, levels = 1) {
        const normalized = RootFs.normalize(path);

        let lI = path.length;
        if(lI < 0) return "/";

        for (let i = 0; i < levels; i++) {
            lI = normalized.lastIndexOf(RootFs.PATH_SEPARATOR, lI - 1);
            if(lI === -1) return RootFs.PATH_SEPARATOR;
        }

        return normalized.substring(0, lI);
    }

    /**
     * Join multiple path segments into a single normalized path.
     * @param  {...string} parts Path segments to join.
     * @returns {string} The joined and normalized path.
     */
    static join(...parts) {
        return RootFs.normalize(parts.join(RootFs.PATH_SEPARATOR));
    }

    /**
     * Joins relative paths with an absolute base path without allowing the relative path to escape outside of the base directory.
     * @param {*} base Base path
     * @param  {...any} parts Parts to join
     * @returns {string} Merged path
     * 
     * @example
     * RootFs.joinSafe("/home/user", "../../dir/../hello.txt"); // -> /home/user/hello.txt
     */
    static joinSafe(base, ...parts) {
        // absolute=true
        base = RootFs.normalize(base, true);

        // absolute=false, allowExit=false
        return base + (base.endsWith(RootFs.PATH_SEPARATOR)? "": RootFs.PATH_SEPARATOR) + RootFs.normalize(parts.join(RootFs.PATH_SEPARATOR), false, false);
    }

    static parseOpenFlagsString(str) {
        if(typeof str === "number") return str;
        if(typeof str !== "string" || str.length > 3) throw new TypeError(`Invalid open flag: ${str}`);

        let i = 0;

        switch (str[0]) {
            case "r":
                i |= str[1] === "+" ? Enums.O_RDWR : Enums.O_RDONLY;
                break;
    
            case "w":
                i |= Enums.O_WRONLY | Enums.O_CREAT | Enums.O_TRUNC;
                break;
    
            case "a":
                i |= Enums.O_WRONLY | Enums.O_CREAT | Enums.O_APPEND;
                break;
    
            default:
                throw new TypeError(`Invalid open flag: ${str}`);
        }
    
        if (str.includes("+")) {
            i &= ~Enums.O_WRONLY;
            i |= Enums.O_RDWR;
        }

        if (str.includes("x")) i |= Enums.O_EXCL;
        if (str.includes("s")) i |= Enums.O_SYNC;
    
        return i;
    }

    /**
     * Approximately convert a windows path to a unix-style path (replace \ with /, remove drive letter, and I guess replaces C:/users with /home).
     */
    static win32toUnix(path) {
        const normalized = RootFs.normalize(path, true, true, true);
        const firstIsDriveLetter = normalized[0]?.length === 2 && normalized[0][1] === ":";
        if(firstIsDriveLetter) normalized.shift();
        if(normalized[0].toLowerCase() === "users") normalized[0] = "home";
        return (firstIsDriveLetter? RootFs.PATH_SEPARATOR: "") + normalized.join(RootFs.PATH_SEPARATOR);
    }

    // Mounts is an array of [mountPoint, fs] pairs.
    #mounts = [];

    constructor(data) {
        this.mount(RootFs.PATH_SEPARATOR, new TmpFs(DEFAULT_FS_DATA));

        if(data) {
            for(const [mountPoint, fs] of data) {
                this.mount(mountPoint, fs);
            }
        }
    }

    /**
     * Mount a filesystem at a given mount point.
     * @param {string} mountPoint The mount point where the filesystem will be mounted.
     * @param {*} fs The filesystem to mount.
     * @returns {number} Error code if mount failed.
     */
    async mount(mountPoint, fs) {
        mountPoint = RootFs.ensureTrailing(mountPoint, true);

        if(mountPoint !== "/") {
            try {
                let stat = await this.stat(mountPoint);
                if(stat.isFile) return Enums.errno.ENOTDIR;
            } catch(e) {
                console.log(e);
                return typeof e === "number"? e: -1;
            }
        }

        this.#mounts.push([mountPoint, fs]);

        // Sort mounts by length of mount point, descending
        this.#mounts.sort((a, b) => b[0].length - a[0].length);
        return true;
    }

    /**
     * Unmount a filesystem from a given mount point.
     * @param {string} mountPoint The mount point to unmount.
     */
    unmount(mountPoint) {
        mountPoint = RootFs.ensureTrailing(mountPoint, true);
        this.#mounts = this.#mounts.filter(([mp, fs]) => mp !== mountPoint);

        // todo: also close all open file descriptors
    }

    /**
     * Returns a list of mounts and their types
     * @returns {Array}
     */
    lsmount(){
        return this.#mounts.map(([a, b]) => [a, {
            type: b?.name || b?.constructor?.fsType || b?.constructor?.name,
            size: b?.size || -1
        }]);
    }

    /**
     * FS operations are always async since they may access the network or other devices, including real filesystem APIs.
     * Filesystem resolution steps:
     * - Normalize path
     * - Resolve filesystem so we know how and where we can access data
     * - Resolve directory
     * - Open path & follow symlinks and check permissions
     * - Obtain handle
     * 
     * @returns {*} fd
     */
    async open(dir, flags = Enums.O_RDONLY, mode = 0, extraFlags = 0, extraData = undefined, absolutePath = true) {
        dir = RootFs.normalize(dir, absolutePath);

        if(typeof flags === "string") {
            flags = RootFs.parseOpenFlagsString(flags);
        }

        // Mounts are sorted by length of mount point, descending.
        const dirWithSep = RootFs.ensureTrailing(dir, null, false);
        for(const ent of this.#mounts) {
            if(dirWithSep.startsWith(ent[0])) {
                const fs = ent[1];
                const fd = await fs.open(dir, flags, mode, extraFlags, extraData);
                if(!fd || typeof fd === "number") throw new Error(Enums.errCode(fd) + " when opening path: " + dir);
                return fd;
            }
        }

        throw new Error("No filesystem available to satisfy request");
    }

    /**
     * Read from a file descriptor. If the file descriptor is invalid, an error will be thrown.
     * @param {*} fd File descriptor to read from
     * @param {*} first Offset to read from
     * @param {*} nbytes Number of bytes to read
     * @param {*} encoding ENUM RootFs.ENCODING or binary/utf8
     * @param {*} close Whether to close the file descriptor after reading
     * @returns {*} Data read
     */
    async read(fd, first = 0, nbytes = -1, encoding = RootFs.ENCODING.utf8, close = true) {
        if(!fd || !fd._fs) throw new Error(Enums.errno.EBADF);
        const data = await fd._fs.read(fd, first, nbytes, typeof encoding === "string"? RootFs.ENCODING[encoding]: encoding);
        if(close) fd._fs.close(fd);
        return data;
    }

    /**
     * Write to a file descriptor. If the file descriptor is invalid, an error will be thrown.
     * @param {*} fd File descriptor to write to
     * @param {*} newData Data to write
     * @param {*} first Offset to write at
     * @param {*} nbytes Number of bytes to write
     * @param {*} close Whether to close the file descriptor after writing
     * @returns {*} Number of bytes written
     */
    async write(fd, newData, first = 0, nbytes = -1, close = true) {
        if(!fd || !fd._fs) throw new Error(Enums.errno.EBADF);
        const nbytesWritten = await fd._fs.write(fd, newData, first, nbytes);
        if(close) fd._fs.close(fd);
        return nbytesWritten;
    }

    /**
     * A higher-level method that simply resolves & reads a file content at a path.
     * Note: file access can involve network/other operations, depending on the type of the fs mounted at a given path, so don't rely on this being guaranteed to resolve in a specified time.
     * @param {*} dir Path to the file to read
     * @param {*} encoding ENUM RootFs.ENCODING or binary/utf8
     * @param {*} options More read options
     * @returns {string|Uint8Array|ArrayBuffer} File content
     */
    async readFile(dir, encoding, options = {}) {
        return await this.read(await this.open(dir), options.start ?? 0, options.nbytes ?? -1, encoding, options.close ?? true);
    }

    /**
     * A higher-level that writes data to a file at a given path. If the file doesn't exist, it will be created. If it exists, it will be truncated.
     * @param {*} dir Path to the file to write
     * @param {*} newData Data to write
     * @param {*} options More write options
     * @returns {*} Number of bytes written
     */
    async writeFile(dir, newData, options = {}) {
        const fd = await this.open(dir, Enums.O_WRONLY | Enums.O_CREAT | Enums.O_TRUNC);
        return await this.write(fd, newData, options.start ?? 0, options.nbytes ?? -1, options.close ?? true);
    }

    async close(fd) {
        if(!fd || !fd._fs) throw new Error(Enums.errno.EBADF);
        return await fd._fs.close(fd);
    }

    async exists(dir) {
        try {
            const fd = await this.open(dir, Enums.O_RDONLY);
            await this.close(fd);
            return true;
        } catch(e) {
            if(e.message.startsWith(Enums.errCode(Enums.errno.ENOENT))) {
                return false;
            }
            throw e;
        }
    }

    async stat(dir) {
        const stat = new Stats;
        const fd = await this.open(dir, Enums.O_RDONLY, null, Enums.XO_STATONLY, stat);
        if(fd === stat) return stat; // ""fast stat"" via the special flag
        fd._fs.stat(fd, stat);
        await this.close(fd);
        return stat;
    }

    async unlink(dir, options = {}) {
        const fd = await this.open(dir, Enums.O_WRONLY);
        const result = await fd._fs.unlink(fd);
        await this.close(fd);
        return result;
    }

    async mkdir(dir, mode = 0o777) {
        const fd = await this.open(dir, Enums.O_WRONLY | Enums.O_CREAT);
        const result = await fd._fs.mkdir(fd, mode);
        await this.close(fd);
        return result;
    }

    /**
     * Creates a new empty rootfs state.
     * @returns {RootFs}
     */
    static initRootFs(){
        return new RootFs();
    }

    // todo
    destroy() {
        for(const [mp, fs] of this.#mounts) {
            if(fs.destroy) fs.destroy();
        }
        this.#mounts = [];
    }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Temporary in-memory-only filesystem for testing and development.
 * This is a simple implementation that uses a Map to store file data in memory.
 */
class TmpFs {
    static fsType = "TmpFs";

    fs = new Map;

    constructor(data) {
        if(data) this.fs = new Map(data);
    }

    /**
     * Takes normalized directory/path, returns file descriptor or error code.
     *
     * @param {*} ndir Path to open.
     * @param {*} flags Open flags, see open(2).
     * @param {*} mode File type and permissions used when using O_CREAT. For example, Enums.S_IFREG | 0o644 to create a file, etc.
     * @returns {*} File descriptor or errno.
     * 
     * dir, flags, mode, extraFlags, extraData
     */
    open(ndir, flags, mode = Enums.S_IFREG | 0o644, extraFlags = 0, extraData = undefined) {
        let data = this.fs.get(ndir);

        if(extraFlags & Enums.XO_STATONLY) {
            if (!data) return Enums.errno.ENOENT;
            return this.stat({ data }, extraData ?? {}, true);
        }

        const accessMode = flags & Enums.O_ACCMODE;
        const canRead =  accessMode === Enums.O_RDONLY ||
                         accessMode === Enums.O_RDWR;
        const canWrite = accessMode === Enums.O_WRONLY ||
                         accessMode === Enums.O_RDWR;

        const createFile = (flags & Enums.O_CREAT);

        if (!data) {
            if (!createFile) {
                return Enums.errno.ENOENT;
            }

            this.create(ndir, mode);
        } else {
            /*
             * O_CREAT | O_EXCL must fail if the path already exists.
             */
            if (createFile && (flags & Enums.O_EXCL)) {
                return Enums.errno.EEXIST;
            }
        }

        /*
         * Directories can be opened, but only for reading/searching.
         * Opening a directory for writing is an error.
         */
        if (!data.isFile && canWrite) {
            return Enums.errno.EISDIR;
        }

        /*
         * O_TRUNC only applies to regular files opened for writing.
         */
        if ((flags & Enums.O_TRUNC) && data.isFile && canWrite) {
            data.contents = new Uint8Array(0);

            const now = Date.now();
            data.mtime = now;
            data.ctime = now;
        }

        return {
            _fs: this,
            data,
            flags,
            ndir,
            offset: (flags & Enums.O_APPEND) && data.isFile
                ? data.contents.length
                : 0,
            closed: false,
            readable: canRead,
            writable: canWrite
        };
    }


    /**
     * Destroy a file descriptor/handle.
     *
     * @param {*} fd File descriptor to be closed.
     * @returns {*} 0 on success or errno.
     */
    close(fd) {
        if (!fd || fd.closed || !fd._fs) {
            return Enums.errno.EBADF;
        }

        fd._fs = null;
        fd.data = null;
        fd.closed = true;

        return 0;
    }


    /**
     * Validate a file descriptor.
     *
     * kind:
     *   0 = regular file
     *   1 = directory
     *
     * @param {*} fd File descriptor.
     * @param {*} kind Expected object type.
     */
    checkFd(fd, kind) {
        if (!fd || !fd._fs || !fd.data || fd.closed) {
            throw new Error(Enums.errno.EBADF);
        }

        if (kind === 1 && fd.data.isFile) {
            throw new Error(Enums.errno.ENOTDIR);
        }

        if (kind === 0 && !fd.data.isFile) {
            throw new Error(Enums.errno.EISDIR);
        }
    }

    create(ndir, mode, uid = 0, gid = 0) {
        const now = Date.now();

        data = {
            mode,
            uid,
            gid,
            atime: now,
            mtime: now,
            ctime: now,
            birthtime: now
        };

        this.fs.set(ndir, data);
        return 0;
    }

    /**
     * Helper to create a directory, not an official hook
     * todo: recurse & check parents
     */
    mkdir(ndir, perms = 0o755, recursive = false, uid = 0, gid = 0) {
        if (this.fs.has(ndir)) {
            return Enums.errno.EEXIST;
        }

        this.create(ndir, Enums.S_IFDIR | perms, uid, gid);
        return 0;
    }

    /**
     * Read from a file.
     *
     * `first` is the byte/character offset to read from.
     * `nbytes === -1` means read until EOF.
     *
     * @param {*} fd File descriptor.
     * @param {*} first Offset.
     * @param {*} nbytes Number of bytes/characters.
     * @param {*} encoding Output encoding.
     * @returns {*} Data.
     */
    read(fd, first, nbytes, encoding) {
        this.checkFd(fd, 0);

        if (!fd.readable) {
            throw new Error(Enums.errno.EBADF);
        }

        const data = fd.data;

        if (first < 0) {
            throw new Error(Enums.errno.EINVAL);
        }

        if (first > data.contents.length) {
            first = data.contents.length;
        }

        const end = nbytes === -1
            ? data.contents.length
            : Math.min(first + Math.max(0, nbytes), data.contents.length);

        /*
         * A successful read is an access to the file.
         */
        data.atime = Date.now();

        const result = data.contents.slice(first, end);

        /*
         * If the descriptor has an offset, advance it.
         */
        fd.offset = end;

        return this._toEncoding(result, encoding);
    }


    /**
     * Write to a file.
     *
     * `first` is the offset to write at.
     * `nbytes === -1` means write all of newData starting at `first`.
     *
     * O_APPEND causes the write to happen at EOF regardless of `first`.
     *
     * @param {*} fd File descriptor.
     * @param {*} newData Data to write.
     * @param {*} first Offset.
     * @param {*} nbytes Number of bytes/characters.
     * @returns {*} Number of bytes/characters written.
     */
    write(fd, newData, first, nbytes) {
        this.checkFd(fd, 0);

        if (!fd.writable) {
            throw new Error(Enums.errno.EBADF);
        }

        const data = fd.data;

        /*
         * Convert ArrayBuffer into Uint8Array.
         */
        if (data.contents instanceof ArrayBuffer) {
            data.contents = new Uint8Array(data.contents);
        }

        /*
         * O_APPEND ignores the supplied offset.
         */
        if (fd.flags & Enums.O_APPEND) {
            first = data.contents.length;
        }

        /*
         * Use the descriptor offset if the caller didn't explicitly supply one.
         */
        if (first === undefined || first === null) {
            first = fd.offset ?? 0;
        }

        if (first < 0) {
            throw new Error(Enums.errno.EINVAL);
        }

        /*
         * Normalize input according to the file's representation.
         */
        if (data.contents instanceof Uint8Array) {
            if (typeof newData === "string") {
                newData = encoder.encode(newData);
            }

            if (!(newData instanceof Uint8Array)) {
                if (newData instanceof ArrayBuffer) {
                    newData = new Uint8Array(newData);
                } else {
                    throw new Error(Enums.errno.EINVAL);
                }
            }

            const available = newData.length - first;

            if (nbytes === -1) {
                nbytes = available;
            }

            if (nbytes < 0 || first > newData.length && nbytes !== 0) {
                throw new Error(Enums.errno.EINVAL);
            }

            if (nbytes === 0) {
                return 0;
            }

            /*
             * The source range is [first, first + nbytes).
             */
            const sourceEnd = Math.min(first + nbytes, newData.length);
            const actualBytes = sourceEnd - first;

            if (actualBytes <= 0) {
                return 0;
            }

            const requiredLength = first + actualBytes;

            if (requiredLength > data.contents.length) {
                const newContents = new Uint8Array(requiredLength);

                newContents.set(data.contents, 0);
                newContents.set(newData.slice(first, sourceEnd), first);

                data.contents = newContents;
            } else {
                data.contents.set(
                    newData.slice(first, sourceEnd),
                    first
                );
            }

            fd.offset = first + actualBytes;

            const now = Date.now();
            data.mtime = now;
            data.ctime = now;

            return actualBytes;
        }


        if (typeof data.contents === "string") {
            if (typeof newData !== "string") {
                newData = decoder.decode(newData);
            }

            if (first > newData.length && nbytes !== 0) {
                throw new Error(Enums.errno.EINVAL);
            }

            if (nbytes === -1) {
                nbytes = newData.length - first;
            }

            if (nbytes < 0) {
                throw new Error(Enums.errno.EINVAL);
            }

            if (nbytes === 0) {
                return 0;
            }

            const sourceEnd = Math.min(first + nbytes, newData.length);
            const actualBytes = sourceEnd - first;

            if (actualBytes <= 0) {
                return 0;
            }

            /*
             * String files are treated as character-addressed.
             * Writing beyond EOF creates the intervening space.
             */
            if (first > data.contents.length) {
                data.contents =
                    data.contents +
                    "\0".repeat(first - data.contents.length);
            }

            data.contents =
                data.contents.substring(0, first) +
                newData.substring(first, sourceEnd) +
                data.contents.substring(first + actualBytes);

            fd.offset = first + actualBytes;

            const now = Date.now();
            data.mtime = now;
            data.ctime = now;

            return actualBytes;
        }

        throw new Error(Enums.errno.EINVAL);
    }


    /**
     * Return file metadata.
     *
     * @param {*} fd File descriptor.
     * @returns {*} stat-like object.
     */
    stat(fd, out, ncheck = false) {
        if(!ncheck) this.checkFd(fd);
        const data = fd.data;

        const now = Date.now();
        data.mtime ??= now;
        data.ctime ??= now;
        data.atime ??= now;
        data.birthtime ??= now;
        data.mode  ??= Enums.S_IFDIR | 0o755;

        out.size = !data.contents? 0:
                   data.contents instanceof Uint8Array
                 ? data.contents.byteLength
                 : data.contents.length;

        out.mode =    data.mode;

        out.mtimeMs = data.mtime;
        out.ctimeMs = data.ctime;
        out.atimeMs = data.atime;

        out.uid =     data.uid ?? 0;
        out.gid =     data.gid ?? 0;
        return out;
    }

    /**
     * In the case of this fs the file gets simply dereferenced from memory since we aren't really linking anything but using JS objects.
     * Todo: ...
     * 
     * @param {*} fd File descriptor.
     * @returns {number} Zero on success, errno enum on error.
     */
    unlink(ndir) {
        this.checkFd(fd);

        if (Stats.typeOf(fd.data.mode)) {
            return Enums.errno.EISDIR;
        }

        this.fs.delete(fd.ndir);
        return 0;
    }

    _toEncoding(data, encoding) {
        if(encoding === RootFs.ENCODING.utf8) return typeof data === "string"? data: decoder.decode(data);
        if(typeof data === "string") {
            return encoder.encode(data);
        }
        return data;
    }

    destroy() {
        this.fs.clear();
    }
}

/**
 * An in-memory zip-based filesystem.
 * Stores data in a zip format in memory, supports compression, can be easily loaded/saved and patched.
 */
class MemFs {}

/**
 * Very simple localStorage-based filesystem for small amounts of data.
 */
class LocalStorageFs extends TmpFs {}

/**
 * Remote cloud filesystem.
 */
class RemoteFs {}

/**
 * IndexedDB-based filesystem for local browser storage.
 */
class IndexedDbFs {}

/**
 * Node.js-based filesystem for direct host-machine storage.
 */
class NodeFs {}

/**
 * WASM filesystem (to be implemented)
 */
class WasmFs {}

/**
 * RQvFS filesystem (to be implemented)
 */
class RqvFs {}

// WARNING: The following imports are just a stub, the actual build system is being worked on.

// Misc constants
const DEFAULT_PROFILE = "/~/assets/image/default.svg";
const isDesktopModeEnabledAtStartup = localStorage.getItem("desktopMode") === "true";

/**
 * Environment loader.
 */
class Environment {
    // Global environment variables
    env = {}

    #k;

    setEnv(n, v) {
        this.env[n] = v;
    }

    async resolvePath(k, pathv = this.#k.env.PATH) {
        for(const s of pathv.split(":")) {
            const rd = await this.#k.fileSystem.readDir(s);
            for(const ent of rd) if(k === ent) return RootFs.join(s, ent);
        }
        return null;
    }

    constructor(k) {
        // if(!(k instanceof Kernel)) throw new Error("Invalid instance of Kernel provided");
        if(!k.isKernel) throw new Error("Invalid instance of Kernel provided");

        this.#k = k;

        this.setEnv("SHELL", "/bin/bash");
        this.setEnv("HOSTNAME", k.sys.uname().nodename);
        this.setEnv("PATH", "/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin");
    }

    init() {
        app.desktop = new LiDesktop({ limited: !isDesktopModeEnabledAtStartup });
    }
}

/**
 * <lstv.space>
 * Shared website object.
 * Utilities and constants related to the site as a whole.
 * This is global and accessible by 3rd party code, nothing sensitive or potentially vulnerable should be exposed.
 */
const app = {
    // Utils
    LoggerContext,
    ContentContext,
    Viewport,
    Thread,
    Window: LS.Window,

    // Create new instance of the desktop env.
    // If desktop mode is disabled, the desktop can skip some features, things like the login prompt, and run in a website-only mode.
    desktop,

    // Constants
    loaded: true,
    isEmbedded: window.self !== window.top,
    cdn: "https://cdn.extragon.cloud",
    api: "https://api.extragon." + (isDebug ? "localhost" : "cloud"),

    /**
     * List of available user badges.
     */
    BADGES: [
        { icon: "owner.png", label: "Owner", id: 0 },
        { icon: "developer.webp", label: "Developer at lstv.space", id: 1 },
        { icon: "supporter.webp", label: "Supporter", id: 2 },
        { icon: "early_supporter.png", label: "Early Supporter", id: 3 },
        { icon: "bug_hunter.png", label: "Bug Hunter", id: 4 },
        { icon: "community_helper.png", label: "Community Helper", id: 5 },
        { icon: "moderator.webp", label: "Moderator", id: 6 },
        { icon: "legacy.webp", label: "Legacy (2018-2024) account", id: -1 },
    ],

    /**
     * Reusable views
     */
    views: {
        getProfilePictureView(source, args, element, user) {
            const filename = (source && typeof source === "object")? source.pfp: source;

            let IMAGE_RESOLUTION = 128;
            if (args && args[0]) {
                const requested = typeof args[0] === "number" ? args[0] : parseInt(args[0], 10);
                IMAGE_RESOLUTION = [32, 64, 128, 256].reduce((prev, curr) =>
                    Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
                );
            }

            const isAnimated = filename && (user && user.__animated_pfp) || filename && filename.endsWith(".webm");
            const src = filename? filename.startsWith("blob:")? filename : app.cdn + '/file/' + filename + (!isAnimated? "?size=" + IMAGE_RESOLUTION: ""): DEFAULT_PROFILE;

            const img = LS.Create(isAnimated ? "video" : "img", {
                alt: "Profile Picture",
                class: "profile-picture",
                draggable: false,
                onerror() {
                    // despite everything, some browsers will still hapily burn your PC down
                    if(this.setDefault) return;

                    if (this.tagName.toLowerCase() === "video") {
                        const image = LS.Create("img", {
                            src: DEFAULT_PROFILE,
                            alt: "Profile Picture",
                            class: "profile-picture",
                            draggable: false,
                        });

                        this.src = "";
                        this.load();
                        this.replaceWith(image);
                        if (args && args[0]) image.style.width = image.style.height = typeof args[0] === "number" ? args[0] + "px" : args[0];
                        return;
                    }

                    if(this.src !== DEFAULT_PROFILE && this.src !== "" && !this.setDefault) {
                        // in case the default also fails, don't set again, otherwise the browser will go crazy (somehow dumb enough not to realize).
                        this.setDefault = true;
                        this.src = DEFAULT_PROFILE;
                    }
                },

                ...isAnimated && {
                    autoplay: false,
                    loop: true,
                    muted: true,
                    preload: "none"
                }
            });

            img.setAttribute("loading", "lazy");
            img.setAttribute("preload", "none");

            if(isAnimated) {
                img.setAttribute("data-src", src);
                // Memory leak: if image is removed, it the observer may still exist, but there's not a way to really fix that
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.load();
                            img.removeAttribute("data-src");
                        }
                        observer.disconnect();
                    }
                });
                observer.observe(img);
            } else {
                img.src = src;
            }

            const wrapper = LS.Create({
                class: "profile-picture-wrapper",
                inner: img
            });

            if (args && args[0]) img.style.width = img.style.height = typeof args[0] === "number" ? args[0] + "px" : args[0];
            wrapper.style.height = img.style.height;
            wrapper.style.width = img.style.width;
            return wrapper;
        },

        getBannerView(source, args, element, user) {
            const filename = (source && typeof source === "object")? source.banner: source;

            if(filename) {
                const src = filename.startsWith("blob:")? filename : app.cdn + '/file/' + filename;
                const isAnimated = user.__animated_banner || filename.endsWith(".webm");

                const img = LS.Create(isAnimated? "video" : "img", {
                    alt: "Banner Picture",
                    class: "banner-media",
                    draggable: false,
                    onerror() { this.remove() },
                    attributes: {
                        alt: "Banner Image",
                        preload: "none"
                    },
                    ...isAnimated && {
                        autoplay: true,
                        loop: true,
                        muted: true
                    }
                });

                img.setAttribute("loading", "lazy");
                img.setAttribute("preload", "none");

                if(isAnimated) {
                    img.setAttribute("data-src", src);
                    const observer = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting) {
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.load();
                                img.removeAttribute("data-src");
                            }
                            observer.disconnect();
                        }
                    });
                    observer.observe(img);
                } else {
                    img.src = src;
                }

                return img;
            } else return null;
        },

        getProfileBadgesView(source, args, element, user) {
            const badges = source && (Array.isArray(source) ? source : Array.isArray(source.badges) ? source.badges : []);
            element.style.display = badges && badges.length ? "flex" : "none";
            if (!badges || !badges.length) return;

            if((user.legacy || +user.createdAt.slice(0, 4) <= 2024) && !badges.includes(-1)) {
                badges.push(-1); // Legacy badge
            }

            return LS.Create({
                class: "badges-container",
                inner: badges.map(badge => {
                    const badgeInfo = app.BADGES.find(b => b.id === badge);
                    if (!badgeInfo) return null;

                    return LS.Create({
                        class: "profile-badge",
                        tooltip: badgeInfo.label,
                        inner: LS.Create("img", {
                            src: "/~/assets/image/badges/" + badgeInfo.icon,
                            alt: badgeInfo.label
                        })
                    });
                })
            });
        },

        getLinksView(source, args, element) {
            const links = source && (Array.isArray(source) ? source : Array.isArray(source.profileLinks) ? source.profileLinks : []);
            element.style.display = links && links.length ? "block" : "none";

            if (!links || !links.length) return;

            return LS.Create({
                class: "links-container",
                inner: links.map(link => {
                    const linkInfo = app.LINKS[link.type.toUpperCase()];

                    return LS.Create("a", {
                        href: link.type === "url" ? link.link : linkInfo.scheme + link.link,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        class: "ls-button pill elevated",
                        accent: link.color || linkInfo.color || null,
                        inner: [
                            link.type === "url"? LS.Create("img", {
                                src: `https://favicone.com/${new URL(link.link).hostname}?s=32`
                            }): LS.Create("i", { class: "bi-" + (linkInfo?.icon || "globe-americas") }),
                            LS.Create("span", {
                                textContent: link.label || (link.type === "url"? new URL(link.link).hostname : link.link)
                            })
                        ]
                    });
                })
            });
        },

        getBioView(source, args, element) {
            const bio = source && (typeof source === "object" ? source.bio : source).trim();
            element.style.display = bio ? "block" : "none";

            if (!bio) return;

            return LS.Create({
                class: "profile-bio",
                innerHTML: app.utils.basicMarkDown(bio)
            })
        },

        getAppIconView(resource, args) {
            const iconParam = resource && resource.icon;
            const iconSrc = iconParam ? app.cdn + "/file/" + iconParam : null;

            const size = args && args[0] ? (typeof args[0] === "number" ? args[0] : parseInt(args[0], 10)) : 32;
            const padding = (size < 24) ? 0 : Math.max(4, (size - 24) / 6);
            const paddedSize = size - (padding * 2);

            const icon = LS.Create(iconSrc ? { tag: "img", attributes: { state: "loading" }, src: iconSrc, onerror() { this.parentElement.replaceChild(app.views.getAppIconView(null, args), this) }, onload() { this.removeAttribute('state'); } } : { tag: "i", class: "bi bi-app-indicator", style: "font-size: " + paddedSize + "px; line-height: 0" })
            icon.style.boxSizing = "border-box";
            icon.style.display = "inline-block";
            icon.style.objectFit = "contain";
            icon.style.verticalAlign = "middle";
            icon.style.position = "relative";
            icon.style.borderRadius = "var(--border-radius)";
            icon.style.padding = padding + "px";
            icon.style.width = size + "px";
            icon.style.height = size + "px";
            icon.draggable = false;

            return icon;
        }
    },

    /**
     * Utility functions
     */
    utils: {
        basicMarkDown(text) {
            text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // URLs: [text](url)
            text = text.replace(
                /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
                '<a href="$2" target="_blank" rel="noopener" data-md-link="1">$1</a>'
            );

            // Only replace URLs not already inside an <a> tag
            text = text.replace(
                /(^|[^"'>])((https?:\/\/[^\s<]+))/g,
                function(match, prefix, url) {
                    // If the URL is already inside a markdown link, skip
                    if (prefix.endsWith('data-md-link="1">')) return match;
                    return prefix + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
                }
            );

            // Horizontal rule: --- or ***
            text = text.replace(/^(?:---|\*\*\*)$/gm, "<hr>");

            // Remove the marker attribute from markdown links
            text = text.replace(/ data-md-link="1"/g, "");

            // Lists: unordered (-, *, +) and ordered (1. 2. ...)
            // Unordered lists
            text = text.replace(
                /(^|\n)((?:\s*[-*+]\s[^\n]+\n?)+)/g,
                function(match, pre, list) {
                    const items = list.trim().split(/\n/).map(line =>
                        line.replace(/^\s*[-*+]\s/, '').trim()
                    );
                    return pre + '<ul>' + items.map(item => '<li>' + item + '</li>').join('') + '</ul>';
                }
            );

            // Ordered lists
            text = text.replace(
                /(^|\n)((?:\s*\d+\.\s[^\n]+\n?)+)/g,
                function(match, pre, list) {
                    const items = list.trim().split(/\n/).map(line =>
                        line.replace(/^\s*\d+\.\s/, '').trim()
                    );
                    return pre + '<ol>' + items.map(item => '<li>' + item + '</li>').join('') + '</ol>';
                }
            );

            // Bold: **text**
            text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

            // Italics: *text*
            text = text.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

            // Underline: __text__
            text = text.replace(/__([^_]+)__/g, "<u>$1</u>");

            // Strikethrough: ~~text~~
            text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");

            // Inline code: `text`
            text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

            return text;
        },

        generateUsername () {
            const adjectives = [
                "Swift", "Neon", "Crimson", "Silent", "Lunar", "Cyber", "Fuzzy", "Vivid",
                "Glitchy", "Quantum", "Fractal", "Shattered", "Prismatic", "Static",
                "Hyper", "Zero", "Binary", "Pixelated", "Chromatic", "Noisy", "Psycho",
                "Turbo", "Aero", "Sonic", "Electric", "Holo", "Infra", "Ultra", "Nano",
                "Mega", "Giga", "Omega", "Rapid", "Frozen", "Burning", "Radiant", "Dark",
                "Void", "Spectral", "Phase", "Echoing", "Warped", "Distorted", "Jagged",
                "Sharp", "Blazing", "Icy", "Molten", "Toxic", "Viral", "Encrypted",
                "Obsidian", "Aurora", "Shiny", "Cursed", "Blessed", "Chaotic", "Lucid"
            ];

            const nouns = [
                "Falcon", "Pixel", "Nova", "Echo", "Shadow", "Circuit", "Pulse", "Glitch",
                "Fragment", "Spectrum", "Core", "Drive", "Signal", "Frame", "Loop",
                "Phase", "Drop", "Blast", "Surge", "Wave", "Stream", "Flow", "Beat",
                "Rhythm", "Synth", "Bass", "Kick", "Snare", "Lead", "Pad", "Drone",
                "Sample", "Track", "Mix", "Layer", "Chain", "Patch", "Bit", "Byte",
                "Packet", "Node", "Port", "Link", "Grid", "Mesh", "Axis", "Vector",
                "Pulsewave", "Overdrive", "Underflow", "Overflow", "Crash", "Stack",
                "Buffer", "Kernel", "Thread", "Process", "Cluster", "Shard", "Crystal",
                "Prism", "Mirror", "Lens", "Scope", "Ray", "Beam", "Flash", "Spark",
                "Bolt", "Storm", "Tempest", "Cyclone", "Vortex", "Tornado", "Quake"
            ];

            return (
                adjectives[Math.floor(Math.random() * adjectives.length)] +
                nouns[Math.floor(Math.random() * nouns.length)] +
                Math.floor(Math.random() * 1000)
            );
        },

        generateSecurePassword(length = 12) {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
            const array = new Uint32Array(length);
            window.crypto.getRandomValues(array);
            let password = "";
            for (let i = 0; i < length; i++) {
                password += charset[array[i] % charset.length];
            }
            return password;
        },

        generateInsecurePassword() {
            return "password";
        }
    },

    ACCENT_COLORS: ["white", "blue", "pastel-indigo", "lapis", "pastel-teal", "aquamarine", "green", "lime", "neon", "yellow", "orange", "deep-orange", "red", "rusty-red", "pink", "hotpink", "purple"], //, "soap", "burple"],

    LINKS: {
        URL: { id: "url", icon: "globe-americas", color: null },
        DISCORD: { id: "discord", icon: "discord", color: "burple", scheme: "https://discord.gg/" },
        TWITTER: { id: "twitter", icon: "twitter-x", color: "black", scheme: "https://twitter.com/" },
        REDDIT: { id: "reddit", icon: "reddit", color: "orange", scheme: "https://reddit.com/u/" },
        TIKTOK: { id: "tiktok", icon: "tiktok", color: "black", scheme: "https://www.tiktok.com/@" },
        YOUTUBE: { id: "youtube", icon: "youtube", color: "red", scheme: "https://youtube.com/@" },
        INSTAGRAM: { id: "instagram", icon: "instagram", color: "orange", scheme: "https://instagram.com/" },
        TWITCH: { id: "twitch", icon: "twitch", color: "purple", scheme: "https://twitch.tv/" },
        LINKEDIN: { id: "linkedin", icon: "linkedin", color: "blue", scheme: "https://linkedin.com/in/" },
        CRYPTO: { id: "crypto", icon: "currency-bitcoin", color: "orange", scheme: "bitcoin:" },
        XBOX: { id: "xbox", icon: "xbox", color: "green", scheme: "https://account.xbox.com/en-us/profile?gamertag=" },
        PLAYSTATION: { id: "playstation", icon: "playstation", color: "blue", scheme: "https://my.playstation.com/profile/" },
        STEAM: { id: "steam", icon: "steam", color: "blue", scheme: "https://steamcommunity.com/id/" },
        PAYPAL: { id: "paypal", icon: "paypal", color: "blue", scheme: "https://paypal.me/" },
        GITHUB: { id: "github", icon: "github", color: "black", scheme: "https://github.com/" }
    },

    errorMessages: {
        400: "Bad Request.",
        401: "Unauthorized.",
        403: "Forbidden.",
        404: "Page not Found.",
        500: "Server Error.",
        502: "Bad Gateway.",
        503: "Service Unavailable.",
        504: "Gateway Timeout."
    },

    set theme(value){
        if(!value) return;
        LS.Color.setTheme(value);
    },

    get theme(){
        return document.body.getAttribute("ls-theme") || "dark";
    },

    // TODO: Multi-account support
    get userFragment() {
        return kernel.userFragment;
    },

    get DESKTOP_MODE() {
        return localStorage.getItem("desktopMode") === "true";
    },

    set DESKTOP_MODE(value) {
        value = !!value;
        localStorage.setItem("desktopMode", value? "true": "false");
        document.body.classList.toggle("lsweb-desktop-mode", value);

        if(value) {
            LS.WindowManager.topOffset = 0;
            LS.WindowManager.bottomOffset = 42;

            app.desktop.panelState = [
                { kind: "apps" },
                { kind: "accounts" },
                { kind: "taskbar" },
                { kind: "spacer" },
                { kind: "clock" },
                { kind: "theme" },
                { kind: "commandPalette" },
            ];

            // todo
            app.desktop._welcome();
        } else {
            LS.WindowManager.topOffset = 50;
            LS.WindowManager.bottomOffset = 0;

            app.desktop.panelState = [
                { kind: "website-header" },
                { kind: "spacer" },
                { kind: "accounts" },
                { kind: "apps" },
                { kind: "theme" },
                { kind: "commandPalette" },
            ];
        }

        app.desktop.updatePanelLayout();

        const switchEl = document.querySelector("#desktopModeSwitch");
        if(switchEl) {
            switchEl.querySelector("input").checked = value;
            if(value) switchEl.querySelector("ls-box")?.remove?.();
        }
    },

    collapseItems: { schedule() {} },

    /**
     * NOTE: This is a cached result, and so may not be up to date. Wherever you can, use await kernel.auth.isLoggedIn(); instead - it's more expensive but accurate.
     */
    isLoggedIn: false,

    toolbarsContainer: document.getElementById("toolbars"),

    /**
     * Register a module/script scope. This scope can request permissions and access APIs.
     * @param {*} script Script tag or unique identifier of the context.
     * @param {LS.Context} runtimeContext Class extending or instance of LS.Context holding the module logic. This class must either: implement a .destroy() method that calls super.destroy(), or subscribe to context.on("destroy") and guarantee proper cleanup. The context will be passed as the first argument.
     */
    register(script, runtimeContext) {
        return kernel.registerModule(script, runtimeContext);
    },

    /**
     * Helper that calls back immediately when the user data is loaded, and subsequently whenever it changes.
     * Reliable method to ensure up-to-date user data at any point without race conditions.
     * TODO: Move to isolated contexts to avoid leaking the user fragment.
     * @param {Function} callback - The function to call with user data updates.
     * 
     * @warning Do NOT use this inside page contexts, use the handy wrapper context.watchUser().
     * Otherwise you this may get called on dead code.
     * 
     * @returns {void}
     */
    watchUser(callback) {
        // user-loaded is a completed event, meaning it will call immediately
        app.once("user-loaded", () => {
            callback(app.isLoggedIn, app.userFragment);
            app.on("user-changed", callback);
        });
    },

    loginTabs: new LS.Tabs("#toolbarLogin", {
        list: false,
        selector: ".login-toolbar-page",
        styled: false
    }),

    // Destroy shared state
    destroyState() {
        app.desktop.destroy();
    },

    /**
     * Check if the current environment has a specific capability.
     * This includes APIs, permissions, or features that may be available only in certain contexts.
     * @param {*} capability - The capability to check for.
     * @returns {boolean} - True if the capability is available, false otherwise.
     */
    hasCapability(capability) {
        // -- Desktop capabilities
        if(capability === "desktop") return !!app.desktop;
        if(capability === "system-sounds") return app.desktop && app.desktop.soundBox !== null;
        if(capability === "windows") return app.desktop && app.desktop.windowManager !== null;
        if(capability === "cloud-user") return location.protocol === "https:"; // todo
        if(capability === "command-palette") return app.desktop && app.desktop.commandPalette !== null; // todo
        if(capability === "notifications") return false; // todo

        // -- System capabilities
        if(capability === "filesystem") return true; // todo
        if(capability === "shell") return true; // todo

        // -- Web APIs
        if(capability === "clipboard") return !!navigator.clipboard;
        if(capability === "css-scroll-animations") return CSS.supports('animation-timeline: scroll()') && CSS.supports('animation-range: 0% 100%');
        if(capability === "gpu") return true; // todo
        if(capability === "midi") return navigator.requestMIDIAccess !== undefined;
        if(capability === "webaudio") return typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined";
        if(capability === "webgpu") return typeof navigator.gpu !== "undefined";
        if(capability === "webxr") return typeof navigator.xr !== "undefined";
        if(capability === "webassembly") return typeof WebAssembly !== "undefined";
        if(capability === "webgl") return typeof WebGLRenderingContext !== "undefined";
        if(capability === "webgl2") return typeof WebGL2RenderingContext !== "undefined";
        if(capability === "webvr") return typeof navigator.getVRDisplays !== "undefined";

        // -- Other
        if(capability === "native") return location.protocol !== "https:" && location.protocol !== "http:" && location.protocol !== "file:";
        if(capability === "vulkan") return false; // todo
        if(capability === "opengl") return false; // todo
        if(capability === "crystaline") return false; // todo
        if(capability === "glitter") return false; // todo
        if(capability === "ls-lisk") return false; // todo
        if(capability === "lsgio") return true; // todo
        if(capability === "http-proxy") return ""; // todo
        if(capability === "network-proxy") return ""; // todo
        return false;
    }
}

app.events = new LS.EventEmitter(app);
globalThis.website = app; // I just can't decide. I think I will keep app due to the app getting more integrated beyond a simple website.
globalThis.app = app;

// WARNING: The following imports are just a stub, the actual build system is being worked on.

/**
 * Kernel class
 * Main application kernel, handles global state, navigation, authentication, and content contexts.
 */
const kernel = new class Kernel extends LS.Context {
    isKernel = true;
    version = KERNEL_VERSION;

    fileSystem = new RootFs();

    threads =     new Set();
    MAX_THREADS = (navigator.hardwareConcurrency || 4) * 2;

    // simulate some syscalls (uh, well, as methods).
    // these are more of functionality abstractions than something that could be used to emulate syscalls.
    // these should not be needed much but provide some helpful information.
    sys = {
        async read(fd, out, nbytes) {
            const data = await this.fileSystem.read(fd, 0, nbytes, RootFs.ENCODING.binary);

            // we can't access pointers with JS so we try writing to a typed array
            if(out && out.set) {
                out.set(data);
            }
        },

        async write(fd, data, nbytes) {
            // likewise, we can't just read memory so we assume data is a typed array
            return await this.fileSystem.write(fd, data, 0, nbytes);
        },

        async open(filename, flags, mode) {
            return await this.fileSystem.open(filename, flags);
        },

        uname(utsname = {}) {
            utsname.sysname  = "LinuxJS";
            utsname.nodename = "linuxjs";
            utsname.release  = KERNEL_VERSION + ".lsw13";
            utsname.version  = "#ls-web Tue Sep 8 08:42:36 UTC 2026";
            utsname.machine  = "js";
            return utsname;
        }
    }

    contexts =     new Map();
    viewports =    new Map();
    applications = new Map();
    pageCache =    new Map();

    aliasMap =     new Map();

    appManifests = new Map();

    environment =  null;

    queryParams = LS.Util.parseURLParams();
    userFragment = LS.Reactive.wrap("user", {});

    SPAExtensions = new LS.SPA.Matcher();

    // scheduler = new class Scheduler {}

    /**
     * Auth/user provider
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

        this.environment = new Environment(this);

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
            this.environment.init();

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

            // app.desktop.initPanel();
            // this.#setupAuth();
            this.loadUser();

            // Display content
            document.querySelector(".loaderContainer").style.display = "none";
            app.container.style.display = "flex";
            app.emit("dom-ready");

            shortcutManager.assign("GLOBAL_OPEN_COMMAND_PALETTE", () => {
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

    *listResources() {
        for(const context of this.contexts.values()) {
            yield context;
        }

        for(const thread of this.threads.values()) {
            yield thread;
        }
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
        const SESSION_ID = LS.Misc.uuidv4(); // True random ID
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

    /**
     * Load an application from the given manifest.
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

    /**
     * Instantiate an application by its ID.
     * @param {string} appId 
     * @param {object} options 
     * @returns {LS.Context}
     */
    instantiateApplication(appId, options = {}) {
        const appConstructor = kernel.applications.get(appId);
        if (!appConstructor) throw new Error("Application not found: " + appId);
        this.log("Instantiating application:", appId);

        // ! fix (this is not the best way to link)
        try {
            appConstructor._appInstantiationContext = {
                appId,
                manifest: this.appManifests.get(appId) || appConstructor.manifest || null,
                options
            };

            const app = new appConstructor(options);
            app.instantiationContext = appConstructor._appInstantiationContext;
            return app;
        } catch(e) {
            // todo
            throw e;
        } finally {
            appConstructor._appInstantiationContext = null;
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

if(isBeta) window.kernel = kernel // Debug only!


} catch (e) { console.error("Fatal error during app initialization:", e); globalThis.__loadError() }
