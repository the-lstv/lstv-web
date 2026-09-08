// WARNING: The following imports are just a stub, the actual build system is being worked on.
import { TmpFs, RootFs } from "./fs.mjs";
import { SoundBox } from "./soundbox.mjs";
import { LiDesktop, MediaPlayer } from "./desktop.mjs";
import { app } from "./shared.mjs";
import { kernel } from "./kernel.mjs";

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

export { LoggerContext, ContentContext, Viewport, Thread, AssetManager };