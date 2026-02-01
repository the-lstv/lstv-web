/*
    lstv.space kernel
    Author: Lukas (thelstv)
    Copyright: (c) https://lstv.space

    Last modified: 2026
    See: https://github.com/the-lstv/lstv-web
*/


// --- SOME PRE-INITIALIZATION STUFF ---

if(window.__kernelInitialized) {
    throw new Error("Kernel was already initialized - this is a bug!");
}

window.__kernelInitialized = true;

const KERNEL_VERSION = (typeof __buildVersion !== "undefined")? __buildVersion: "1.2.3-beta";

window.cacheKey = "?mtime=" + (LS.Util.parseURLParams(document.currentScript?.src, "mtime") || Date.now()); // Mtime mapped to kernel.js (This should never fallback)

if(!window.LS || typeof LS !== "object" || LS.v < 5) {
    window.__loadError('<h3 style="margin:40px 20px">The application framework failed to load. Please try again later.</h3>')
    throw new Error("Fatal error: Missing LS, or it's too old! Make sure it was loaded properly! Aborting.");
}

// Forward declarations
const scriptingLoadTime = Date.now();
const shortcutManager = new LS.ShortcutManager();

const isDebug = window.location.hostname === "lstv.localhost";
const isBeta = window.location.hostname.startsWith("beta.lstv.");

// Console welcome message
if(!isDebug) console.log(
    '%c LSTV %c\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO STEAL PERSONAL INFORMATION OR SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#e74c3c, #e74c3c 33%, #f39c12 33%,#f39c12 66%,#3498db 66%,#3498db);border-radius:1em;color:white;font-weight:900;margin:1em 0',
    'font-size:1.5em;color:#ed6c30;font-weight:bold',
    'font-size:1em;font-weight:400'
);

const BUILTIN_APPS = [
    {
        name: "Townhall",
        id: "townhall",
        icon: "cd18c88051bcdc92.svg",
        description: "A social community platform with servers, text & voice channels, threads, and more.",
        version: "1.0.0",
        link: "/chat",
    },
    {
        name: "Video Editor",
        id: "video-editor",
        icon: "32c0975799f31fc3.svg",
        description: "A full-featured, simple but professional video editor",
        version: "1.0.0",
        external: true,
        link: "/editor",
    },
    {
        name: "Resources",
        id: "resource-monitor",
        icon: "4cf4213e702a21fe.svg",
        description: "Monitor loaded pages and applications.",
        version: "1.0.0",
        main: "resourcemanager.mjs",
    },
    {
        name: "Clock",
        id: "clock",
        icon: "d2973ce4286307f8.svg",
        description: "What is the current time?",
        version: "1.0.0",
        main: "clock.mjs",
    },
    {
        name: "Text Editor",
        id: "text-editor",
        icon: "ecf15bde6c275d83.svg",
        description: "A simple Markdown text editor for your notes.",
        version: "1.0.0",
        main: "texteditor.mjs",
    },
    {
        name: "Email",
        id: "mail-client",
        icon: "901fb7f3abda204f.svg",
        description: "Manage your emails.",
        version: "1.0.0",
        main: "mail.mjs",
    },
]

Document.prototype.write = Document.prototype.writeln = function() {
    throw new Error("Document.write is disabled for security and performance reasons. You should not use it.");
};

// --- MEMORY SAFETY ---
// We can use globals in the kernel, anywhere else should throw an error
const setTimeout = LS.Context.setTimeout;
const setInterval = LS.Context.setInterval;
const clearTimeout = LS.Context.clearTimeout;
const clearInterval = LS.Context.clearInterval;
const requestAnimationFrame = LS.Context.requestAnimationFrame;
const queueMicrotask = LS.Context.queueMicrotask;
const fetch = LS.Context.fetch;

/**
 * Application model:
 * - Kernel                     - Manages everything
 *   - Viewport                 - Renders ContentContexts
 *   - Page / Application       - Represents a single page or application instance
 *     - ContentContext         - Manages content, assets, state
 *       - Assets               - Styles and Scripts
 *       - Modules              - Extend functionality of ContentContexts
 *       - SPA Extensions       - Handle SPA navigation for specific paths
 *   - ContentContext           - Can be as an application itself
 *       - Window (Viewport)    - Contexts can create viewports in the form of windows.
 */


// --- START ---

try {

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
class ContentContext extends LS.Context {
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
        const win = new website.Window(options);
        win.renderFrom(this);
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
            this.aliases = options.aliases.map(alias => website.utils.normalizePath(alias));
            for(const alias of this.aliases) {
                kernel.aliasMap.set(alias, this);
            }
        }

        // Unique path that clearly identifies this context, not required for non-page contexts.
        if (options.path) {
            const newPath = website.utils.normalizePath(options.path);
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
            this.logContext.tag = `Context:${options.contextName}`;
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

            console.log("Waiting for assets", this.styles, this.scripts);
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

        pattern = website.utils.normalizePath(pattern || this.#path);
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
        this.emit("resume");
        kernel.quickEmit("context-updated");
        return this;
    }

    /**
     * Equivalent to website.watchUser, but scoped to this context.
     * @param {*} callback 
     */
    watchUser(callback) {
        website.once("user-loaded", () => {
            if(this.destroyed) return;

            callback(website.isLoggedIn, website.userFragment);
            this.addExternalEventListener(website, "user-changed", callback);
        });
    }

    registerModule(runtimeContext) {
        if(this.destroyed) return;
        return kernel.registerModule(this, runtimeContext, this);
    }

    requestKernelAccess() {
        // TODO: Verify access
        return kernel;

        LS.Toast.show("Kernel access request denied.", { accent: "red" });
        this.destroy();
        throw new Error("Kernel access request denied.");
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

        if(this.options.disableRemotePages && (!page || page.src)) {
            kernel.error("Remote pages are disabled for this viewport (" + this.name + ").");
            return false;
        }

        // Normalize path
        if (typeof path === "string") {
            path = website.utils.normalizePath(path);
        }

        // 1. Check for SPA Extensions (Routes)
        const SPAExtension = options.browserTriggered? null: kernel.resolveSPAExtension(path);
        if (SPAExtension) {
            if (SPAExtension[2] !== this.current) {
                // We need to navigate to the base page first
                await this.navigate(SPAExtension[2], { browserTriggered: true });
            }

            if(location.pathname !== path && !options.browserTriggered && options.pushState !== false && this.name === 'main') {
                history.pushState({ path }, document.title, path);
            }
            kernel.handleSPAExtension(path, SPAExtension, options.targetElement || null);
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

                if(this.name === "main" && !firstPage) LS.Animation.fadeIn(page.content, {
                    duration: 300,
                    direction: 'forward',
                    easing: 'ease-out'
                });
                firstPage = false;
            }

            this.current = page;

            if (this.name === 'main') {
                document.title = (page.title && page.title.startsWith("LSTV | "))? page.title: `LSTV | ${page.title || 'Untitled'}`;
                
                if (!options.browserTriggered && !options.initial) {
                    history.pushState({ path }, document.title, page.path);
                }
                website.closeToolbar();
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

    renderFrom(context) {
        return context.render(this.target).then(() => {
            this.current = context;
            this.emit("rendered", context);
            return true;
        }).catch((e) => {
            kernel.error("Rendering from context failed:", e);
            this.errorPage(500);
            return false;
        });
    }

    errorPage(status) {
        this.errorPageElement; // Ensure it's created

        this.errorPageStatus.textContent = String(status);
        this.errorPageMessage1.textContent = website.errorMessages[status] || 'Unexpected error.';
        this.errorPageMessage2.textContent = this.errorPageMessage1.textContent;
        this.target.replaceChildren(this.errorPageElement);
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

    static fromCode(code, options = {}) {
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


let globalWindowZIndex = 1000;

/**
 * Window class
 * Spawns a draggable & resizable memory-safe manageable floating window.
 */
class Window extends Viewport {
    // static TEMPLATE = LS.CompileTemplate((data, logic) => ({
    //     class: 'window-container',
    //     inner: [
    //         logic.export("header", { class: 'level-1 window-header', inner: [
    //             [
    //                 logic.export("icon", { class: 'window-icon', src: data.icon, tag: 'img' }),
    //                 logic.export("title", { class: 'window-title text-overflow-nowrap', textContent: data.name, tag: 'span' }),
    //             ],

    //             { class: 'window-header-buttons', inner: [
    //                 {
    //                     tag: 'button',
    //                     class: 'window-maximize-button circle elevated',
    //                     inner: { tag: 'i', class: 'bi-window' },
    //                     tooltip: 'Toggle Window View',
    //                     onclick: data.toggleView
    //                 },
    //                 {
    //                     tag: 'button',
    //                     class: 'window-minimize-button circle elevated',
    //                     inner: { tag: 'i', class: 'bi-dash-lg' },
    //                     onclick: data.minimize
    //                 },
    //                 {
    //                     tag: 'button',
    //                     class: 'window-maximize-button circle elevated',
    //                     inner: { tag: 'i', class: 'bi-square' },
    //                     onclick: data.maximize
    //                 },
    //                 {
    //                     tag: 'button',
    //                     class: 'window-close-button circle elevated',
    //                     inner: { tag: 'i', class: 'bi-x-lg' },
    //                     onclick: data.close
    //                 },
    //             ]}
    //         ]}),

    //         data.target
    //     ],
    // }));

    // Precompiled
    static TEMPLATE = function(d){'use strict';var e0=document.createElement("div");e0.className="window-container";var e1=document.createElement("div");e1.className="level-1 window-header";var e2=document.createElement("div");var e3=document.createElement("img");e3.src=d.icon;e3.className="window-icon";e2.appendChild(e3);var e4=document.createElement("span");e4.textContent=d.name;e4.className="window-title text-overflow-nowrap";e2.appendChild(e4);var e5=document.createElement("div");e5.className="window-header-buttons";var e6=document.createElement("button");e6.onclick=d.toggleView;e6.setAttribute("ls-tooltip","Toggle Window View");LS.Tooltips.updateElement(e6);e6.className="window-maximize-button circle elevated";var e7=document.createElement("i");e7.className="bi-window";e6.appendChild(e7);var e8=document.createElement("button");e8.onclick=d.minimize;e8.className="window-minimize-button circle elevated";var e9=document.createElement("i");e9.className="bi-dash-lg";e8.appendChild(e9);var e10=document.createElement("button");e10.onclick=d.maximize;e10.className="window-maximize-button circle elevated";var e11=document.createElement("i");e11.className="bi-square";e10.appendChild(e11);var e12=document.createElement("button");e12.onclick=d.close;e12.className="window-close-button circle elevated";var e13=document.createElement("i");e13.className="bi-x-lg";e12.appendChild(e13);e5.append(e6,e8,e10,e12);e1.append(e2,e5);var dyn14=LS.__dynamicInnerToNode(d.target);e0.append(e1,dyn14);var __rootValue=e0;return{"header":e1,"icon":e3,"title":e4,root:__rootValue};}

    constructor(options = {}) {
        super(`window-${options.id || "untitled"}-${LS.Tiny.M.uid()}`, N({
            class: 'window-content-container viewport-content',
        }), options);

        this.isWindow = true;

        const window = Window.TEMPLATE({
            name: this.getTitle(),
            icon: this.getIcon(),
            target: this.target,
            minimize: () => this.minimize(),
            maximize: () => this.maximize(),
            close: () => this.close(),
            toggleView: () => this.toggleView(),
        });

        this.windowElement = window.root;
        this.titleElement = window.title;
        this.iconElement = window.icon;

        this.windowElement.style.opacity = 0;

        let startX, startY;
        this.windowHandle = new LS.Util.TouchHandle(window.header, {
            buttons: [0],
            exclude: true,
            frameTimed: true,
            cursor: 'move',

            onStart: (event) => {
                startX = event.x - this.x;
                startY = event.y - this.y;
                this.focus();
            },

            onMove: (event) => {
                this.setPosition(event.x - startX, event.y - startY);
            }
        });

        this.windowElement.addEventListener("mousedown", () => {
            this.focus();
        }, { passive: true });

        this.resize = LS.Resize.set(this.windowElement, {
            sides: true,
            corners: true,
            styled: false,
            minWidth: 300,
            minHeight: 100,
            ...options.resizeOptions || {},
            translate: true,
        });

        this.resize.handler.on("resize", (side, nW, nH, nX, nY) => {
            this.width = nW;
            this.height = nH;
            this.x = nX;
            this.y = nY;
            this.emit("resize", [nW, nH, side, nX, nY]);
        });

        kernel.windows.add(this);

        this.setSize(options.width || 600, options.height || 400, false);
        this.setPosition(options.x || ((innerWidth / 2) - (this.width / 2)), options.y || ((innerHeight / 2) - (this.height / 2)), false);

        requestAnimationFrame(() => {
            if(this.destroyed) return;
            LS.Animation.fadeIn(this.windowElement, {
                duration: 300,
                direction: "backward",
                preserveTransform: true
            });
        });

        // To be worked on
        document.body.appendChild(this.windowElement);

        this.on("rendered", () => {
            // Update title and icon based on content
            this.setTitle(this.getTitle());
            this.setIcon(this.getIcon());

            this.focus();
            this.emit("ready");
        });
    }

    setPosition(x, y, evt = true) {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        const NET = 60;
        let left = Math.max(NET + 90 - this.width, Math.min(x, screenW - NET));
        let top = Math.max(NET, Math.min(y, screenH - NET));

        this.x = left;
        this.y = top;

        this.windowElement.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        if(evt) this.emit("move", [left, top]);
    }

    setSize(width, height, evt = true) {
        this.width = Number(width);
        this.height = Number(height);
        this.windowElement.style.width = this.width + "px";
        this.windowElement.style.height = this.height + "px";
        if(evt) this.emit("resize", [this.width, this.height, null, this.x, this.y]);
    }

    getTitle(context) {
        context ??= this.current;
        return this.title || this.id || (context && (context.title || context.constructor.manifest.title || context.constructor.manifest.name || context.id || context.constructor.manifest.id || context.constructor.name) || "Untitled Window");
    }

    getIcon(context) {
        context ??= this.current;
        return this.icon || (context && (context.icon || context.constructor.manifest.icon || null)) || null;
    }

    setTitle(title) {
        this.title = title;
        this.titleElement.textContent = title;
    }

    setIcon(icon) {
        this.icon = icon;
        if(icon) {
            this.iconElement.src = website.cdn + "/file/" + icon;
            this.iconElement.style.display = "";
        } else {
            this.iconElement.src = "";
            this.iconElement.style.display = "none";
        }
    }

    minimize() {
        if(this.current) this.current.suspend();
    }

    maximize() {}

    focus() {
        globalWindowZIndex += 1;
        this.windowElement.style.zIndex = globalWindowZIndex;

        for (const win of kernel.windows) {
            if (win !== this && win.windowElement) {
                win.windowElement.classList.remove("top");
            }
        }

        this.windowElement.classList.add("top");
        this.quickEmit("focus");
    }

    blur() {
        this.windowElement.classList.remove("top");
        this.quickEmit("blur");
    }

    toggleView() {
        // To be worked on
    }

    // Closes the window with animation
    close() {
        LS.Animation.fadeOut(this.windowElement, {
            duration: 300,
            direction: "backward",
            preserveTransform: true
        }).then(() => {
            if(this.destroyed) return;
            this.destroy();
        });
    }

    destroy(destroyContent = true) {
        if(this.destroyed) return;
        // Don't set destroyed to true yet; we will propagate to Viewport destroy

        if(this.windowHandle) this.windowHandle.destroy();
        this.windowHandle = null;

        this.resize.handler.destroy();
        this.resize = null;

        if(this.windowElement) {
            LS.Resize.remove(this.windowElement);
            this.windowElement.remove();
        }

        this.windowElement = null;
        this.titleElement = null;
        this.iconElement = null;
        kernel.windows.delete(this);

        // Propagates all the way down to destroying the content context
        super.destroy(destroyContent);
    }
}

// Enables closing the toolbar via esc
const ToolbarStackRef = { close() { website.closeToolbar() } };


/**
 * Website object
 * Utilities and constants related to the website as a whole.
 * This is global, so nothing sensitive should be exposed.
 */
const website = {
    // Utils
    LoggerContext,
    ContentContext,
    Viewport,
    Thread,
    Window,

    // Constants
    loaded: true,
    isEmbedded: window.self !== window.top,
    cdn: "https://cdn.extragon.cloud",
    api: "https://api.extragon." + (isDebug ? "localhost" : "cloud"),

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
            const src = filename? filename.startsWith("blob:")? filename : website.cdn + '/file/' + filename + (!isAnimated? "?size=" + IMAGE_RESOLUTION: ""): "/assets/image/default.svg";

            const img = N(isAnimated ? "video" : "img", {
                alt: "Profile Picture",
                class: "profile-picture",
                draggable: false,
                onerror() {
                    if (this.tagName.toLowerCase() === "video") {
                        const image = N("img", {
                            src: "/assets/image/default.svg",
                            alt: "Profile Picture",
                            class: "profile-picture",
                            draggable: false,
                        });

                        this.replaceWith(image);
                        this.src = "";
                        this.load();
                        if (args && args[0]) image.style.width = image.style.height = typeof args[0] === "number" ? args[0] + "px" : args[0];
                        return;
                    }
                    this.src = "/assets/image/default.svg"
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
                const src = filename.startsWith("blob:")? filename : website.cdn + '/file/' + filename;
                const isAnimated = user.__animated_banner || filename.endsWith(".webm");

                const img = N(isAnimated? "video" : "img", {
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
                    const badgeInfo = website.BADGES.find(b => b.id === badge);
                    if (!badgeInfo) return null;

                    return LS.Create({
                        class: "profile-badge",
                        tooltip: badgeInfo.label,
                        inner: LS.Create("img", {
                            src: "/assets/image/badges/" + badgeInfo.icon,
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
                    const linkInfo = website.LINKS[link.type.toUpperCase()];

                    return LS.Create("a", {
                        href: link.type === "url" ? link.link : linkInfo.scheme + link.link,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        class: "ls-button pill elevated",
                        accent: link.color || linkInfo.color || null,
                        inner: [
                            link.type === "url"? N("img", {
                                src: `https://favicone.com/${new URL(link.link).hostname}?s=32`
                            }): N("i", { class: "bi-" + (linkInfo?.icon || "globe-americas") }),
                            N("span", {
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

            return N({
                class: "profile-bio",
                innerHTML: website.utils.basicMarkDown(bio)
            })
        },

        getAppIconView(resource, args) {
            const iconParam = resource && resource.icon;
            const iconSrc = iconParam ? website.cdn + "/file/" + iconParam : null;

            const size = args && args[0] ? (typeof args[0] === "number" ? args[0] : parseInt(args[0], 10)) : 32;
            const padding = (size < 24) ? 0 : Math.max(4, (size - 24) / 6);
            const paddedSize = size - (padding * 2);

            const icon = LS.Create(iconSrc ? { tag: "img", attributes: { state: "loading" }, src: iconSrc, onerror() { this.parentElement.replaceChild(website.views.getAppIconView(null, args), this) }, onload() { this.removeAttribute('state'); } } : { tag: "i", class: "bi bi-app-indicator", style: "font-size: " + paddedSize + "px; line-height: 0" })
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

    utils: {
        normalizePath(path, isAbsolute = null) {
            // Replace backslashes with forward slashes
            path = path.replace(/index\.html$|\.html$/i, "").replace(/\\/g, "/").trim();

            const parts = path.split('/');
            const normalizedParts = [];
        
            for (const part of parts) {
                if (part === '..') {
                    normalizedParts.pop();
                } else if (part !== '.' && part !== '') {
                    normalizedParts.push(part);
                }
            }

            const normalizedPath = normalizedParts.join('/');

            if(isAbsolute === null) isAbsolute = path.startsWith('/');
            return (isAbsolute ? '/' : '') + normalizedPath;
        },

        generateIdentifier(){
            return crypto.getRandomValues(new Uint32Array(1))[0].toString(36) + Date.now().toString(36);
        },

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

    collapseItems: { schedule() {} },

    // NOTE: This is a cached result, and so may not be up to date. Wherever you can (async context), use await kernel.auth.isLoggedIn(); instead - it's more expensive but more accurate.
    isLoggedIn: false,
    isToolbarOpen: false,

    toolbarsContainer: document.getElementById("toolbars"),

    openToolbar(name, toggle = false) {
        if(website.currentToolbar == name && website.isToolbarOpen) {
            if(toggle) website.closeToolbar();
            return;
        }

        const toolbar = website.toolbars.get(name);
        if(!toolbar) return;

        const previousToolbar = website.currentToolbar && website.toolbars.get(website.currentToolbar);
        if(previousToolbar) {
            if(typeof previousToolbar.onClose === "function") previousToolbar.onClose();

            if(previousToolbar.panelItem) {
                const element = previousToolbar.panelItem instanceof HTMLElement? previousToolbar.panelItem : website.panelItems.get(previousToolbar.panelItem)?.element;
                if(element) element.classList.remove("open");
            }
        }

        if(typeof toolbar.onOpen === "function") toolbar.onOpen();

        // TODO: this is incredibly ass
        toolbar.element.classList.add("open");
        for(const tb of website.toolbars.values()) {
            if(tb !== toolbar) tb.element.classList.remove("open");
        }

        if (website.isToolbarOpen) LS.Animation.slideInToggle(toolbar.element, previousToolbar?.element || null);
        if (!website.isToolbarOpen) LS.Animation.fadeIn(toolbar.element, null, "up");

        website.isToolbarOpen = true;
        website.currentToolbar = name;
        website.quickEmit("toolbar-open", name);
        kernel.viewport.target.classList.add("shade");
        LS.Stack.push(ToolbarStackRef);

        const button = toolbar.panelItem instanceof HTMLElement? toolbar.panelItem : website.panelItems.get(toolbar.panelItem)?.element;
        if(button) button.classList.add("open");

        return toolbar;
    },

    closeToolbar() {
        if(!website.isToolbarOpen) return;

        const toolbar = website.toolbars.get(website.currentToolbar);
        LS.Animation.fadeOut(toolbar.element, null, "down");

        if(toolbar) {
            if(typeof toolbar.onClose === "function") toolbar.onClose();
            const button = toolbar.panelItem instanceof HTMLElement? toolbar.panelItem : website.panelItems.get(toolbar.panelItem)?.element;
            if(button) button.classList.remove("open");
            website.currentToolbar = null;
        }

        for(const item of website.panelItems.values()) {
            item.element.classList.remove("open");
        }

        website.isToolbarOpen = false;
        website.quickEmit("toolbar-close");
        kernel.viewport.target.classList.remove("shade");
        LS.Stack.remove(ToolbarStackRef);
    },

    async openPalette() {
        if (website.isEmbedded) return;

        if (!website.palette) {
            if(kernel._initializingPalette) {
                await kernel._initializingPalette;
            } else {
                kernel._initializingPalette = kernel._initializeCommandPalette();
                await kernel._initializingPalette;
                kernel._initializingPalette = null;
            }
        }

        website.palette.open();
    },

    showLoginToolbar(toggle = false) {
        const accountsButton = website.panelItems.get("accountsButton").element;

        accountsButton.focus();
        setTimeout(() => {
            if(!toggle && website.isToolbarOpen && website.currentToolbar === "login") return;

            website.openToolbar("login", toggle);

            if(!website.isLoggedIn) setTimeout(() => {
                O("#loginPopup")?.querySelector("button,input")?.focus();
            }, 0);
        }, 0);
    },

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
     * @warning Do NOT use this inside page contexts, use context.watchUser(). Otherwise you this may get called on dead code.
     */
    watchUser(callback) {
        // user-loaded is a completed event, meaning it will call immediately
        website.once("user-loaded", () => {
            callback(website.isLoggedIn, website.userFragment);
            website.on("user-changed", callback);
        });
    },

    loginTabs: new LS.Tabs(O("#toolbarLogin"), {
        list: false,
        selector: ".login-toolbar-page",
        styled: false
    }),

    panelItems: new Map([
        ["accountsButton", { label: "Account", showIcon: false, buttonLabel: { class: "accountsButton", inner: [{ reactive: "user.username ?? 'Log-In'" }, { class: "profile-picture-preview", inner: { tag: "i", class: "bi-person-fill" } }] }, description: "View and edit your profile or log-in", icon: "bi-person-fill", onclick: () => website.openToolbar("login") }],

        ["appsButton", { label: "Apps", tooltip: "Applications", description: "View applications", icon: "bi-grid-fill", onclick() { website.openToolbar("apps", true) } }],

        // ["assistantButton", { showLabel: false, label: "Assistant", description: "Open Assistant", icon: "bi-stars", onclick() {
        //     website.openToolbar("assistant", true);
        // } }],

        ["themeButton", { buttonLabel: N('i', { class: "bi-palette-fill" }), label: "Customize", description: "Customize the site appearance", icon: "bi-palette-fill", onclick() {
            website.openToolbar("theme", true);
        }}],

        ["commandPaletteButton", { showLabel: false, label: "Command Palette", tooltip: "Command Palette", description: "Open Command Palette", icon: "bi-terminal", onclick() {
            website.closeToolbar();
            website.openPalette();
        }}],
    ]),

    toolbars: new Map([
        ["login", {
            element: O("#toolbarLogin"),
            name: "Account",
            description: "View and edit your profile or log-in",
            panelItem: "accountsButton",
            onOpen() {
                website.loginTabs.set(website.isLoggedIn? "account": "default", true);
            }
        }],

        ["apps", {
            element: O("#toolbarApps"),
            name: "Apps",
            description: "View applications",
            panelItem: "appsButton",

            onOpen() {
                if(!kernel.applicationMenu.initialized) {
                    kernel.applicationMenu.init();
                }
            }
        }],

        ["assistant", {
            element: O("#toolbarAssistant"),
            name: "Assistant",
            description: "Open Assistant",
            panelItem: "assistantButton",
            onOpen() {
                if(!window.__assistantLoading) {
                    window._assistantCallback = null;
                    window.__assistantLoading = true;

                    setTimeout(async () => {
                        M.LoadScript("/~/assets/js/assistant.js" + window.cacheKey, (error) => {
                            if(error || typeof window._assistantCallback !== "function") {
                                LS.Toast.show("Sorry, assistant failed to load. Please try again later.");
                                return;
                            }

                            window._assistantCallback(website, kernel.auth);
                        })
                    }, 0);
                }
            }
        }],

        ["theme", {
            element: O("#toolbarTheme"),
            name: "Theme",
            description: "Customize the site appearance",
            panelItem: "themeButton"
        }],

        ["musicPlayer", {
            element: O("#musicPlayer"),
            name: "Music Player",
            description: "Control music playback",
            get panelItem() { return website.musicPlayer.musicStatusElement; },

            onOpen() {
                if(!website.musicPlayer.initialized) website.musicPlayer.init();
            }
        }],

        ["more", {
            element: O("#toolbarMore"),
            name: "More",
            description: "More options",
            panelItem: "moreButton"
        }]
    ]),

    musicPlayer: new class MusicPlayer {
        constructor() {
            this.toolbarElement = O("#musicPlayer");
            this.initialized = false;
            if(!this.toolbarElement) {
                console.warn("Music Player toolbar element not found.");
                return;
            }

            shortcutManager.register('ctrl+m', () => {
                website.openToolbar("musicPlayer", true);
            });
        }

        init(){
            if(this.initialized) return;
            this.initialized = true;
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
            this.musicStatusElement = N("button", {
                id: "musicButton",
                class: "pill",
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
                website.openToolbar("musicPlayer", true);
            };

            this.musicStatusElement.style.display = "none";
            O(".headerLeftContainer").appendChild(this.musicStatusElement);
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

            website.collapseItems.schedule();
            setTimeout(() => {
                website.collapseItems.schedule();
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
    },
}

website.events = new LS.EventEmitter(website);
window.website = website;


/**
 * Simple routing class to match groups and wildcards.
 * Taken from Akeno (https://github.com/the-lstv/akeno)
 */
class Matcher {
    constructor(options = {}, info = null) {
        this.exactMatches = new Map();
        this.wildcards = new WildcardMatcher(options.segmentChar || "/", []);
        this.fallback = null;
        this.options = options;
    }

    *expandPattern(pattern) {
        if (typeof pattern !== 'string') {
            throw new Error('Pattern must be a string');
        }

        // Expand only groups not preceded by '!'. Negated groups are preserved for the matcher.
        let searchFrom = 0;
        while (true) {
            const group = pattern.indexOf('{', searchFrom);
            if (group === -1) break;
            const prevChar = group > 0 ? pattern[group - 1] : null;
            if (prevChar !== '!') {
                const endGroup = pattern.indexOf('}', group);
                if (endGroup === -1) {
                    throw new Error(`Unmatched group in pattern: ${pattern}`);
                }

                const groupValues = pattern.slice(group + 1, endGroup);
                const patternStart = pattern.slice(0, group);
                const patternEnd = pattern.slice(endGroup + 1);

                for (let value of groupValues.split(',')) {
                    value = value.trim();
                    const next = patternStart + value + (value === "" && patternEnd.startsWith('.') ? patternEnd.slice(1) : patternEnd);
                    yield* this.expandPattern(next);
                }
                return;
            }
            searchFrom = group + 1;
        }

        if(pattern[pattern.length - 1] === '/') {
            pattern = pattern.slice(0, -1);
        }
        yield pattern;
    }

    add(pattern, handler) {
        if(Array.isArray(pattern)) {
            for(const p of pattern) {
                this.add(p, handler);
            }
            return;
        }

        if (typeof pattern !== 'string' || !handler) {
            throw new Error('Invalid route definition');
        }

        if (pattern.endsWith('.')) {
            pattern = pattern.slice(0, -1);
        }

        if (pattern === '*' || pattern === '**') {
            this.fallback = handler;
            return;
        }

        if (!pattern) {
            return;
        }

        // Expand pattern groups (non-negated only)
        for (const expandedPattern of this.expandPattern(pattern)) {
            // Route patterns with wildcards or negated groups to the wildcard matcher
            if (expandedPattern.indexOf('*') !== -1 || expandedPattern.indexOf('!{') !== -1) {
                this.wildcards.add(expandedPattern, handler);
                continue;
            }

            const existingHandler = this.exactMatches.get(expandedPattern);
            if (existingHandler && existingHandler !== handler) {
                if(this.options.mergeObjects) {
                    handler = Object.assign(existingHandler, handler);
                    continue;
                }

                this.warn(`Warning: Route already exists for domain: ${expandedPattern}, it is being overwritten.`);
            }

            this.exactMatches.set(expandedPattern, handler);
        }
    }

    clear() {
        this.exactMatches.clear();
        this.wildcards.patterns = [];
        this.fallback = null;
    }

    remove(pattern) {
        if (typeof pattern !== 'string') {
            throw new Error('Invalid route pattern');
        }

        for (const expandedPattern of this.expandPattern(pattern)) {
            this.exactMatches.delete(expandedPattern);
            this.wildcards.filter(route => route.pattern !== expandedPattern);
        }
    }

    getBasePath(pattern) {
        const specialIndex = Math.min(
            pattern.indexOf('{') !== -1 ? pattern.indexOf('{') : Infinity,
            pattern.indexOf('*') !== -1 ? pattern.indexOf('*') : Infinity
        );
        
        if (specialIndex !== Infinity) {
            pattern = pattern.slice(0, specialIndex);
        }

        return pattern.replace(/[/!]+$/, '');
    }

    match(input) {
        // Check exact matches first
        const handler = this.exactMatches.get(input);
        if (handler) {
            return handler;
        }

        // Check wildcard matches
        const wildcardHandler = this.wildcards.match(input);
        if (wildcardHandler) {
            return wildcardHandler;
        }

        // If no specific route found, return the fallback route
        if (this.fallback) {
            return this.fallback;
        }

        return false;
    }
}

class WildcardMatcher {
    constructor(segmentChar = "/", patterns = []) {
        this.segmentChar = segmentChar || "/";
        this.patterns = patterns || [];
    }

    add(pattern, handler = pattern) {
        const rawParts = this.split(pattern);
        const parts = rawParts.map(p => {
            if (p.length > 3 && p.startsWith('!{') && p.endsWith('}')) {
                const values = p.slice(2, -1).split(',').map(v => v.trim()).filter(v => v !== '');
                return { type: 'negSet', set: new Set(values) };
            }
            return p;
        });

        // Try to merge with an existing pattern that differs by exactly one string segment
        for (const existing of this.patterns) {
            if (existing.handler !== handler || existing.parts.length !== parts.length) continue;

            let diffIndex = -1;
            let canMerge = true;

            for (let i = 0; i < parts.length; i++) {
                const existingPart = existing.parts[i];
                const newPart = parts[i];

                // Check if parts are equal
                if (existingPart === newPart) continue;

                // Check if existing is a set and new part is a string that can be added
                if (typeof existingPart === 'object' && existingPart && existingPart.type === 'set' && typeof newPart === 'string') {
                    if (diffIndex !== -1) { canMerge = false; break; }
                    diffIndex = i;
                    continue;
                }

                // Check if both are strings (can be converted to set)
                if (typeof existingPart === 'string' && typeof newPart === 'string') {
                    if (diffIndex !== -1) { canMerge = false; break; }
                    diffIndex = i;
                    continue;
                }

                // Parts are incompatible
                canMerge = false;
                break;
            }

            if (canMerge && diffIndex !== -1) {
                const existingPart = existing.parts[diffIndex];
                const newPart = parts[diffIndex];

                if (typeof existingPart === 'object' && existingPart.type === 'set') {
                    // Add to existing set
                    existingPart.set.add(newPart);
                } else {
                    // Convert string to set
                    existing.parts[diffIndex] = { type: 'set', set: new Set([existingPart, newPart]) };
                }
                return;
            }
        }

        this.patterns.push({ parts, handler, pattern });
        this.patterns.sort((a, b) => b.parts.length - a.parts.length);
    }

    filter(callback) {
        this.patterns = this.patterns.filter(callback);
        return this;
    }

    split(path) {
        if (path === "" || !path) return [""];
        if (path[0] !== this.segmentChar) path = this.segmentChar + path;
        return path.split(this.segmentChar);
    }

    /**
     * Fast wildcard matching with segment support.
     * @param {string|array} input - The input string or array of segments to match against.
     */
    match(input) {
        const path = Array.isArray(input) ? input : this.split(input);

        for (const { parts, handler } of this.patterns) {
            // Exact match
            if (parts.length === 1) {
                const only = parts[0];
                if (only === "**" || (typeof only === 'string' && path.length === 1 && ((only === "*" && path[0] !== "") || only === path[0]))) {
                    return handler;
                }

                if (typeof only === 'object' && only) {
                    if (only.type === 'negSet' && path.length === 1 && path[0] !== "" && !only.set.has(path[0])) {
                        return handler;
                    }
                    if (only.type === 'set' && path.length === 1 && only.set.has(path[0])) {
                        return handler;
                    }
                }
                continue;
            }

            let pi = 0, si = 0;
            let starPi = -1, starSi = -1;

            while (si < path.length) {
                const part = parts[pi];
                if (pi < parts.length && part === "**") {
                    starPi = pi;
                    starSi = si;
                    pi++;
                } else if (pi < parts.length && part === "*") {
                    if (path[si] === "") break;
                    pi++;
                    si++;
                } else if (pi < parts.length && typeof part === 'object' && part) {
                    if (part.type === 'negSet') {
                        if (path[si] === "" || part.set.has(path[si])) break;
                    } else if (part.type === 'set') {
                        if (path[si] === "" || !part.set.has(path[si])) break;
                    }
                    pi++;
                    si++;
                } else if (pi < parts.length && part === path[si]) {
                    pi++;
                    si++;
                } else if (starPi !== -1) {
                    pi = starPi + 1;
                    starSi++;
                    si = starSi;
                } else {
                    break;
                }
            }

            while (pi < parts.length && parts[pi] === "**") pi++;
            if (pi === parts.length && si === path.length) {
                return handler;
            }
        }
        return null;
    }
}


/**
 * Kernel class
 * Main application kernel, handles global state, navigation, authentication, and content contexts.
 */
const kernel = new class Kernel extends LoggerContext {
    version = KERNEL_VERSION;

    contexts = new Map();
    viewports = new Map();
    applications = new Map();
    pageCache = new Map();

    aliasMap = new Map();

    threads = new Set();

    windows = new Set();

    shortcutManager = shortcutManager;

    queryParams = LS.Util.params();
    userFragment = LS.Reactive.wrap("user", {});

    SPAExtensions = new Matcher();

    MAX_THREADS = (navigator.hardwareConcurrency || 4) * 2;

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
            website.isLoggedIn = result;
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
        this.events = new LS.EventEmitter(this);

        website.viewport = this.viewport = new Viewport('main', document.getElementById('viewport'), {
            kernel: this
        });

        this.ttl = Date.now() - window.__loadTime;
        this.log('Kernel initialized, version %c' + this.version + '%c, time since first load: ' + this.ttl + 'ms', 'font-weight:bold', 'font-weight:normal');

        LS.Reactive.registerType("ProfilePicture", website.views.getProfilePictureView);
        LS.Reactive.registerType("ProfileBadges", website.views.getProfileBadgesView);
        LS.Reactive.registerType("ProfileBanner", website.views.getBannerView);
        LS.Reactive.registerType("ProfileLinks", website.views.getLinksView);
        LS.Reactive.registerType("ProfileBio", website.views.getBioView);
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
            const themeButton = website.panelItems.get("themeButton").element;
            if (themeButton) themeButton.querySelector("i").className = "bi-" + (website.theme == "light"? "moon-stars-fill": "sun-fill");
        });

        this.auth.on("user-updated", (patch) => {
            if (patch) {
                Object.assign(this.userFragment, patch);
            }
        });

        this.auth.on("account-switched", (reason, from, to) => {

        });

        document.addEventListener('DOMContentLoaded', () => {
            website.container = this.container = document.getElementById('app');
            website.viewportElement = this.viewportElement = this.viewport.target;

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

            this.#initializeToolbars();
            this.loadUser();

            // Display content
            document.querySelector(".loaderContainer").style.display = "none";
            website.container.style.display = "flex";
            website.emit("dom-ready");

            this.shortcutManager.register(['ctrl+shift+p', 'ctrl+k'], () => {
                website.openPalette();
            });

            if(isBeta) {
                document.querySelector(".homeButton").append(document.createTextNode(" Beta"));
                LS.Toast.show("You are using a beta version of lstv.space. Some features may be unstable or incomplete.", { accent: "orange", timeout: 60000 });
            }
        });

        // Event listener for back/forward buttons (for single-page app behavior)
        const originalState = location.pathname;
        window.addEventListener('popstate', (event) => {
            if(isDebug) this.log("Popstate event:", event);
            const href = event.state?.path ?? location.pathname;
            kernel.viewport.navigate(href, { pushState: false });
        });

        // Keep floating windows in view on resize
        this.windowBoundsScheduler = new LS.Util.FrameScheduler(() => {
            for (const win of this.windows) {
                if (win.destroyed || !win.windowElement) continue;
                win.setPosition(win.x ?? 0, win.y ?? 0);
            }
        });

        const scheduleWindowClamp = () => this.windowBoundsScheduler.schedule();
        window.addEventListener('resize', scheduleWindowClamp);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleWindowClamp);

        window.addEventListener('click', (event) => {
            const targetElement = event.target.closest("a");

            if (targetElement) {
                if(targetElement.hasAttribute("target")) return;
                if(targetElement.href.endsWith("#")) return event.preventDefault();

                const link = targetElement.href;
                let href = targetElement.getAttribute('href');

                if(link.startsWith(location.origin) && !link.endsWith("?") && !link.startsWith(location.origin + ":")){
                    if(href.startsWith(location.origin)) href = href.substring(location.origin.length);
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
                                fetch(website.api + "/metascraper?url=" + encodeURIComponent(link)).then(response => response.json()).then(data => {
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
        website.fetch = this.auth.fetch.bind(this.auth);
        website.emit("ready");

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
        path = website.utils.normalizePath(path);

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
        path = website.utils.normalizePath(path);
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
        path = website.utils.normalizePath(path);
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
                this.error("Error initializing module for context", context.path || context.id, e);
                return null;
            }

            return moduleInstance;
        }
    }

    async loadUserList() {
        const accounts = await this.auth.listAccounts();
        website.accounts = accounts && accounts.accounts || [];

        const list = website.toolbars.get("login").element.querySelector(".accounts-list");
        list.innerHTML = "";

        for (const account of website.accounts) {
            const item = LS.Create("button", { class: 'account-item elevated loading-right', tabindex: 0, inner: [
                website.views.getProfilePictureView(account.pfp, [ 32 ]),
                N('span', { class: 'account-username', textContent: account.username })
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
                        website.loginTabs.set("login");
                        website.loginTabs.element.querySelector("#username").value = account.username;
                        website.loginTabs.element.querySelector(".error-message").textContent = "Session expired for this account, please log in again.";
                        const p = website.loginTabs.element.querySelector("#password");
                        p.value = "";
                        p.focus();
                        return;
                    }

                    LS.Toast.show("Failed to switch account: " + (error.message || error.error || "Unknown error"), { accent: "red" });
                });
            };

            list.appendChild(item);
        }

        website.events.emit("user-list-updated", [ website.accounts ]);
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

        // There should never be a situation where accountsButton doesn't exist, yet it has happened to me. How..
        const accountsButton = website.panelItems.get("accountsButton").element;
        if (accountsButton) accountsButton.disabled = false;

        website.events.emit("user-changed", [ isLoggedIn, this.userFragment ]);
        website.events.completed("user-loaded");

        if(!this.__pingsInitialized) this.#initializePings();
    }

    handleSPAExtension(href, extension, targetElement) {
        const [path, handler, context] = extension;
        if (typeof handler !== "function") {
            return;
        }

        const extendedPath = website.utils.normalizePath(href.replace(path, ""), false);
        context.emit("spa-navigate", [ extendedPath, targetElement ]);
        handler(extendedPath, targetElement);
    }

    requestPermission(scope, permissions = []) {
        // For now, all scopes are granted without prompt (TEMPORARY)
        return new this.#PermissionScope(permissions);
    }

    async _initializeCommandPalette() {
        if (this._initializingPalette || website.palette) return;
        const CommandPalette = (await import("/~/assets/js/pallete.mjs")).default;
        const topBar = O("#topOverlay");
        const paletteBar = O("#commandPaletteBar");
        const paletteContainer = O("#commandPalette");
        const terminalContainer = O("#commandTerminal");
        const terminalOutput = terminalContainer.querySelector(".terminal-output");

        const paletteLogger = new LoggerContext("Command Palette");
        website.palette = new CommandPalette({
            wrapperElement: paletteContainer,
            menuElement: paletteContainer.querySelector(".completion-menu"),
            iconElement: paletteContainer.querySelector(".command-icon"),
            textDisplayElement: paletteContainer.querySelector(".command-text"),
            hintElement: paletteContainer.querySelector(".command-hint"),
            inputElement: paletteContainer.querySelector(".command-input"),
            terminalOutput: terminalOutput,

            fontWidth: 9.6 * 1.2,

            onClose(){
                LS.Animation.fadeOut(topBar, 300, "down");
            },

            onOpen(){
                LS.Animation.fadeIn(topBar, 300, "up");
            },

            logger: paletteLogger
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

        const terminalWriter = {
            log: website.palette.log.bind(website.palette)
        }

        this.terminalWriter = terminalWriter;
        paletteLogger.writer = terminalWriter;

        paletteBar.querySelector("button").onclick = () => {
            website.palette.close();
        };

        website.palette.register([
            {
                name: "kernel-info",
                alias: ["kernel-version", "version"],
                icon: 'bi-cpu-fill',
                description: "Show kernel information",
                async onCalled() {
                    terminalOutput.appendChild(N('img', {
                        src: '/~/assets/image/kernel-icons/kernel-' + KERNEL_VERSION.slice(0, 3) + '.png?v=' + KERNEL_VERSION[4],
                        style: 'margin:auto;display:block'
                    }));

                    terminalWriter.log(
                        `%clstv.space%c kernel`,
                        "color:var(--accent);font-weight:bold;font-size:1.2em",
                        "color:inherit;font-weight:bold;font-size:1.2em"
                    );
                    terminalWriter.log(
                        `%cVersion:%c ${kernel.version} (Zen)`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cLS version:%c ${LS.version}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cViewports:%c ${kernel.viewports.size}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cPages:%c ${kernel.pageCache.size} / 20`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cThreads:%c ${kernel.threads.size} / ${kernel.MAX_THREADS}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cWindows:%c ${kernel.windows.size}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cSigned in:%c ${await kernel.auth.isLoggedIn() ? "Yes" : "No"}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
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
                    terminalWriter.log(
                        `%cUptime:%c ${prettyUptime}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                }
            },

            {
                name: "settings",
                icon: "bi-gear",
                description: "More settings",
                children: [
                    {
                        name: "notifications",
                        icon: "bi-bell",
                        description: "Enable or disable notifications",
                        children: [
                            {
                                name: "enable",
                                icon: "bi-bell-fill",
                                description: "Enable notifications",
                            },
                            {
                                name: "disable",
                                icon: "bi-bell-slash",
                                description: "Disable notifications",
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
                                    terminalWriter.log("Statistics sharing " + (enabled ? "enabled - Thank you!" : "disabled - No statistics data will be sent from this browser from now on."));

                                    if(!enabled) {
                                        terminalWriter.log("Warning: This setting is not saved to your account and is specific to this browser. Make sure to update this setting on other devices.");
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
                            terminalWriter.log("Warning: It is recommended to reload the page for this setting to take effect");
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
                ]
            },

            {
                name: "set-accent",
                icon: "bi-palette2",
                description: "Set an accent color",

                onCalled(color) {
                    LS.Color.setAccent(color);
                },

                inputs: [
                    { name: "preset", type: "list", list: [ { name: "custom", icon: "bi-palette2", type: "color" }, ...website.ACCENT_COLORS.map(accent => ({
                        name: accent,
                        icon: `bi-circle-fill`,
                        accentColor: accent,
                        value: accent
                    }))] }
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
                        website.theme = theme;
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
                    website.openToolbar(toolbar);
                    website.palette.close();
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
                name: "echo",
                alias: ["print"],
                icon: "bi-chat",
                description: "Echo input",
                onCalled(text) { terminalWriter.log(text) },
                inputs: [
                    { name: "text", type: "string", description: "Text to echo" }
                ]
            },

            {
                name: "clear",
                icon: "bi-trash",
                alias: ["clear-terminal", "cls"],
                description: "Clear the terminal output",
                onCalled() { terminalOutput.innerHTML = "" }
            },

            {
                name: "close",
                alias: ["exit"],
                icon: "bi-x-circle",
                description: "Close the command palette",
                onCalled() { website.palette.close() }
            }
        ]);
    }

    #initializeToolbars() {
        const nav = O("#topPanel");
        const moreButton = O("#moreButton");
        const container = O(".headerButtons");

        moreButton.addEventListener("click", () => {
            website.openToolbar("more", true);
        });

        const menu = O("#toolbarMore");

        const navPadding = 28 + 5;
        const gap = 10;
        
        for (const item of website.panelItems.values()) {
            if(item.shortcuts) {
                this.shortcutManager.register(item.shortcuts, () => {
                    if(item.onclick) item.onclick.call(item.element);
                });
            }
        }

        const collapseItems = new LS.Util.FrameScheduler(() => {
            const availableSpace = nav.clientWidth - navPadding - gap - moreButton.clientWidth - (nav.firstElementChild?.clientWidth || 0);

            let takenSpace = 0, hasCollapsedItems = false;
            for (const item of website.panelItems.values()) {
                if(!item.element) {
                    const icon = item.showIcon === false ? null : { tag: "i", class: item.icon };
                    const buttonLabel = item.buttonLabel || item.label;

                    item.element = LS.Create("button", {
                        class: "toolbar-button pill elevated",
                        attributes: { "aria-label": item.description },
                        tooltip: item.tooltip || item.label,
                        inner: item.showLabel !== false? [icon, N("span", { inner: buttonLabel, class: typeof buttonLabel === "string" ? "label" : "" })]: icon,
                        onclick: () => {
                            if(item.onclick) item.onclick.call(item.element);
                        }
                    });

                    container.appendChild(item.element);
                }

                const detached = item.element.classList.contains("detached");
                const w = item.element.clientWidth + gap;
                takenSpace += w;

                if(takenSpace > availableSpace) {
                    hasCollapsedItems = true;
                    if(detached) continue;
                    item.element.classList.add("detached");

                    if(!item.menuElement) {
                        item.menuElement = LS.Create({
                            class: "toolbar-menu-item",
                            attributes: { "aria-label": item.description },
                            inner: [{ tag: "i", class: item.icon }, { tag: "span", innerText: item.label }],
                            onclick: () => {
                                if(item.onclick) item.onclick.call(item.element);
                            }
                        })
                    }

                    menu.appendChild(item.menuElement);
                } else {
                    if(!detached) continue;
                    item.element.classList.remove("detached");
                    if(item.menuElement && item.menuElement.parentElement) {
                        item.menuElement.parentElement.removeChild(item.menuElement);
                    }
                }
            }

            // Close the toolbar if no items are collapsed and it's currently open
            if (!hasCollapsedItems && website.isToolbarOpen && website.currentToolbar === "more") {
                website.closeToolbar();
            }

            moreButton.style.display = (availableSpace + moreButton.clientWidth) < takenSpace ? "inline-flex" : "none";
            resizeMessageSwitch.set(window.innerHeight < 100 || window.innerWidth < 200);
        });

        const resizeMessageContainer = document.getElementById("resizeMessage");
        const resizeMessageSwitch = new LS.Util.Switch((on) => {
            if(on) {
                resizeMessageContainer.style.display = "flex";
                website.container.style.display = "none";
            } else {
                resizeMessageContainer.style.display = "none";
                website.container.style.display = "flex";
            }
        });

        collapseItems.callback();
        collapseItems.schedule();
        window.addEventListener("resize", () => {
            collapseItems.schedule();
        });

        if(window.visualViewport) {
            window.visualViewport.addEventListener("resize", () => {
                collapseItems.schedule();
            });
        }

        website.collapseItems = collapseItems;

        O("#logOutButton").on("click", function (){
            kernel.auth.logout(() => {
                LS.Toast.show("Logged out successfully.", {
                    timeout: 2000
                });

                website.closeToolbar();
                kernel.loadUser();
                website.loginTabs.set("default");
            });
        });

        function clearLoginError() {
            const view = website.loginTabs.currentElement();
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

            const errorMessage = website.loginTabs.currentElement().querySelector(".error-message");
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
                website.closeToolbar();
                website.loginTabs.set("default");
            });
        }

        document.forms["loginForm"].addEventListener("submit", (event) => {
            event.preventDefault();
            clearLoginError();
            const username = O("#username").value;
            const password = O("#password").value;

            if (!username || !password) {
                displayLoginError("Username and password are required", O(!username? "#username" : "#password"));
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
            website.loginTabs.set('register-step2');

            return false;
        });

        document.forms["registerStep2Form"].addEventListener("submit", (event) => {
            event.preventDefault();
            clearLoginError();
            const email = O("#regEmail").value;
            const username = O("#regUsername").value.toLowerCase();
            const password = O("#regPassword").value;
            const displayName = event.target.querySelector("input[name='displayname']").value;

            if (!email || !username || !password) {
                website.loginTabs.set('register');
                displayLoginError("All fields are required");
                return;
            }

            this.auth.register({ email, username, password, displayname: displayName || null }, (error, result) => {
                if (error) {
                    website.loginTabs.set('register');
                    console.log(error, (error.code === 4 || error.code === 5)? O("#regEmail"): (error.code === 3 || error.code === 6)? O("#regUsername"): error.code === 7? O("#regPassword"): null);
                    
                    displayLoginError(error.message || error.error || "An error occurred while signing up", (error.code === 4 || error.code === 5)? O("#regEmail"): (error.code === 3 || error.code === 6)? O("#regUsername"): error.code === 6? O("#regPassword"): null);
                    return;
                }

                redirectAfterLogin();
            });
  
            return false;
        });

        website.loginTabs.on("changed", (tab, old) => {
            const view = website.loginTabs.currentElement();
            const oldElement = website.loginTabs.tabs.get(old)?.element;

            clearLoginError();

            view.style.transition = (!website.isToolbarOpen || !oldElement)? "none" : "";

            LS.Animation.slideInToggle(view, oldElement);

            setTimeout(() => {
                O("#toolbarLogin").style.height = view.offsetHeight + "px";
            });
        });

        website.loginTabs.set(location.pathname.startsWith("/login") ? "login" : location.pathname.startsWith("/sign-up") ?  "register" : "default");

        O("#randomPassword").on("click", function (){
            const password = website.utils.generateSecurePassword(12);
            O("#regPassword").value = password;
            O("#regPassword").dispatchEvent(new Event("input"));
            alert("Your generated password: " + password);
        });

        O("#randomUsername").on("click", function (){
            const username = website.utils.generateUsername();
            O("#regUsername").value = username.toLowerCase();
            O("#regUsername").dispatchEvent(new Event("input"));
            O("#displayname").value = username;
        });

        for(let accent of website.ACCENT_COLORS) {
            O("#accentButtons").add(N("button", {
                class: "square",
                inner: accent === "white" ? N("i", { class: "bi-x-circle-fill" }) : null,
                accent,
                tooltip: accent === "white" ? "Reset": (accent.charAt(0).toUpperCase() + accent.slice(1)),
                onclick(){
                    LS.Color.setAccent(accent);
                }
            }));

            O("#accentButtons").get("input[type=color]").on("input", function (){
                LS.Color.setAccent(this.value);
            });
        }

        document.addEventListener("pointerdown", (event) => {
            if (website.isToolbarOpen && !event.target.closest("#toolbars,.toolbar-button")) website.closeToolbar();
            if (kernel.windows.size > 0 && !event.target.closest(".window-container") ) {
                for (const windowInstance of kernel.windows.values()) {
                    windowInstance.blur();
                }
            }
        }, { passive: true });
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
        const SESSION_ID = website.utils.generateIdentifier(); // True random ID
        let current_interval = 15000, first = true;

        const sendPing = (beacon = false) => {
            if (document.hidden) {
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
                userLoggedIn: website.isLoggedIn, // No identifiable info, just yes/no
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
                        current_interval = Math.min(current_interval + 5000, 60000);
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

            const container = website.toolbars.get("apps").element;
            this.appListElement = container.get(".app-list");

            kernel.events.on("application-installed", (manifest) => {
                this.addApplicationEntry(manifest);
            });

            // Load existing apps
            for(const manifest of BUILTIN_APPS) {
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
                    website.views.getAppIconView(manifest, [64]),
                    N('span', { class: 'app-name text-overflow-nowrap', textContent: manifest.name || appId })
                ],

                onclick: () => {
                    if(manifest.external) {
                        if(typeof manifest.link !== "string" || !manifest.link) {
                            LS.Toast.show("This application does not have a valid link.", { accent: "red" });
                            return;
                        }

                        window.open(manifest.link, "_blank", "noopener");
                        website.closeToolbar();
                        return;
                    }

                    if (!kernel.applications.has(appId)) {
                        appButton.setAttribute("state", "loading");
                        kernel.loadApplication(manifest).then(() => {
                            appButton.removeAttribute("state");
                            const appInstance = kernel.instantiateApplication(appId);
                            appInstance.open?.();
                            website.closeToolbar();
                        }).catch(error => {
                            appButton.removeAttribute("state");
                            LS.Toast.show("Failed to load application: " + error.message, { accent: "red" });
                        });
                        return;
                    }

                    const appInstance = kernel.instantiateApplication(appId);
                    appInstance.open?.();
                    website.closeToolbar();
                }
            });

            this.appListElement.appendChild(appButton);
        }
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

        const module = await AssetManager.requireScript("/~/apps/" + manifest.main, true);
        const AppClass = module.default ?? module;

        if (typeof AppClass !== "function" || !LS.Util.isClass(AppClass) || !(AppClass.prototype instanceof ContentContext)) throw new Error("Application module does not export a default class or does not extend ContentContext");
        kernel.applications.set(appId, AppClass);
        AppClass.manifest = manifest;

        delete window.module;
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
        return new AppClass();
    }
}


} catch (e) { console.error("Fatal error during app initialization:", e); window.__loadError() }