/*
    lstv.space kernel
    Author: Lukas (thelstv)
    Copyright: (c) https://lstv.space

    Last modified: 2025
    See: https://github.com/the-lstv/lstv-web
*/


// --- SOME PRE-INITIALIZATION STUFF ---

const KERNEL_VERSION = "1.2.0-beta";
window.cacheKey = "?mtime=" + document.currentScript.src.split("?mtime=")[1];
if(!window.LS || typeof LS !== "object" || LS.v < 5) {
    window.__loadError('<h3 style="margin:40px 20px">The application framework failed to load. Please try again later.</h3>')
    throw new Error("Fatal error: Missing LS, or it's too old! Make sure it was loaded properly! Aborting.");
}

// Console welcome message
console.log(
    '%c LSTV %c\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO STEAL PERSONAL INFORMATION OR SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#e74c3c, #e74c3c 33%, #f39c12 33%,#f39c12 66%,#3498db 66%,#3498db);border-radius:1em;color:white;font-weight:900;margin:1em 0',
    'font-size:1.5em;color:#ed6c30;font-weight:bold',
    'font-size:1em;font-weight:400'
);


// --- START ---

try {

/**
 * LoggerContext class
 * Provides unified logging utilities and is meant to isolate logging per context, and redirect logs to different writers when needed.
 */
class LoggerContext {
    constructor(context, writer = null) {
        this.logContext = context;
        this.tag = `%c[${context}]%c`;
        this.tagStyle = 'font-weight: bold';
        this._writer = writer;
    }

    get writer() {
        return this._writer || window.Logger || console;
    }

    set writer(value) {
        this._writer = value;
    }

    writeLog(func = console.log, tagStyle, message, ...data) {
        const isString = typeof message === 'string';
        if(!isString) data.unshift(message);
        func.call(this.writer, this.tag + (isString ? " " + message : ''), tagStyle + this.tagStyle, 'color: inherit; font-weight: normal;', ...data);
        website.emit('global-log-stream', [this.logContext, message, ...data]);
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
        Array.from(document.querySelectorAll('link[rel="stylesheet"], script[src]')).forEach(asset => {
            const key = this.#toKey(asset);

            // Yeah, hardcoding is not the best idea
            // But this needs to filter all persistent assets
            if(asset.classList.contains("whitelist") || key.includes("/ls/") || key.includes("bootstrap-icons") || key.includes("fonts.googleapis.com") || key.includes("/assets/js/app.js") || key.includes("/assets/css/main.css") || key.includes("/assets/js/pallete.js")) {
                this.whitelist.add(key);
            } else {
                if(asset instanceof HTMLLinkElement) {
                    this._initialExternalAssets.styles.push(asset);
                } else if(asset instanceof HTMLScriptElement) {
                    this._initialExternalAssets.scripts.push(asset);
                }
            }

            this.register(asset, false);
        });
    }

    #toKey(source) {
        return this.fuzzKey((source instanceof HTMLLinkElement) ? source.href : (source instanceof HTMLScriptElement) ? source.src : source);
    }

    fuzzKey(source) {
        let absSource = source;
        try {
            absSource = new URL(source, window.location.origin).href;
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

    registerStyle(source, element, execute = true){
        const key = this.fuzzKey(source);
        this.styles.set(key, element);
        if (execute) document.head.appendChild(element);
    }

    registerScript(source, element, execute = true){
        const key = this.fuzzKey(source);
        this.scripts.set(key, element);
        if (execute) document.head.appendChild(element);
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
            document.head.appendChild(style);
        });
    }

    requireScript(source) {
        return new Promise((resolve, reject) => {
            if (this.has(source)) {
                resolve(this.get(source));
                return;
            }

            let script = this.cloneScript(source);
            script.onload = () => resolve(script);
            script.onerror = (e) => reject(e);
            this.registerScript(script.src, script);
            document.head.appendChild(script);
        });
    }

    cloneScript(source) {
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
            script.src = source;
            return script;
        }
        return null;
    }

    remove(source) {
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
class ContentContext extends LS.EventHandler {
    #path = null;

    constructor(options = {}) {
        super();
        this.id = options?.id || "context-" + Math.random().toString(36).substring(2, 10) + "-" + Date.now().toString(36);

        // Can be awaited to make sure content is loaded
        this.loadPromise = null;

        this.styles = [];
        this.scripts = [];

        this.content = null;
        this.destroyed = false;

        // FIXME: Sandboxing needs to be better implemented

        this.state = "empty"; // empty | ready | suspended | destroyed
        this.sandboxMode = "none"; // none | shadow | iframe

        this.loaded = false;
        this.error = null;

        if(options) {
            this.setOptions(options);
        }

        // this.on("resume", async () => {});

        this.on("suspend", () => {
            this.state = "suspended";
            for(const style of this.styles) {
                style.disabled = true;
            }

            this.content?.remove();
        });

        this.on("destroy", () => {
            this.emit("suspend");
            this.state = "destroyed";
            this.content?.remove();
            this.content = null;
            this.events.clear();
            kernel.contexts.delete(this.id);
            kernel.pageCache.delete(this.#path);

            let i = 0;
            for(const [,, page] of kernel.SPAExtensions) {
                if(page === this) {
                    kernel.SPAExtensions.splice(i, 1);
                }
                i++;
            }

            if(this.aliases) for(const alias of this.aliases) {
                kernel.aliasMap.delete(alias);
            }

            this.loadPromise = null;
            this.destroyed = true;

            // Unload assets that are not used elsewhere
            for (const style of this.styles) {
                let stillUsed = false;
                for (const ctx of kernel.pageCache.values()) {
                    if (ctx !== this && ctx.styles && ctx.styles.includes(style)) {
                        stillUsed = true;
                        break;
                    }
                }
                if (!stillUsed) AssetManager.remove(style);
            }
            for (const script of this.scripts) {
                let stillUsed = false;
                for (const ctx of kernel.pageCache.values()) {
                    if (ctx !== this && ctx.scripts && ctx.scripts.includes(script)) {
                        stillUsed = true;
                        break;
                    }
                }
                if (!stillUsed) AssetManager.remove(script);
            }

            this.scripts = null;
            this.styles = null;
        });
    }

    async #loadCSS(){
        const promises = [];
        for (const style of this.styles) {
            style.disabled = false;
            if (!style.isConnected) {
                document.head.appendChild(style);
                if (style.tagName === "LINK" && style.rel === "stylesheet" && !style.sheet) {
                    promises.push(new Promise((resolve, reject) => {
                        style.addEventListener("load", resolve, { once: true });
                        style.addEventListener("error", resolve, { once: true });
                    }));
                }
            }
        }

        await Promise.all(promises);
    }

    async #loadJS(){
        const promises = [];
        for (const script of this.scripts) {
            if (!script.isConnected) {
                document.head.appendChild(script);
                if (script.src && !script.hasAttribute("data-loaded")) {
                    if(this.destroyed) return;

                    const promise = new Promise((resolve, reject) => {
                        script.addEventListener("load", () => {
                            script.setAttribute("data-loaded", "true");
                            resolve();
                        }, { once: true });
                        script.addEventListener("error", resolve, { once: true });
                    });

                    if(script.async) {
                        promises.push(promise);
                    } else await promise;
                }
            }
        }
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

        if(options.id) {
            this.id = options.id;
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
    }

    async render(targetElement = null){
        if(this.state === "loading" || this.state === "destroyed" || (this.state === "ready" && targetElement && this.content && targetElement.contains(this.content))) {
            return this;
        }

        this.state = "loading";

        if(this.src && this.sandboxMode !== "iframe" && !this.loaded) {
            await (this.loadPromise || this.fromURL());
            if(this.destroyed) return this;
        }

        if(this.sandboxMode === "iframe" && !(this.content instanceof HTMLIFrameElement)) {
            this.replaceContent(); // Create iframe
        } else if (!this.content) {
            return;
        }

        // Unsure whether to load JS and CSS in parallel (before render) or load JS separately after render, since some scripts may expect DOM to exist.
        // Loading early allows for quicker execution though (eg. if JS is responsible for rendering something, it will be available before actually displaying).
        await Promise.all([
            this.#loadCSS(),
            this.#loadJS()
        ]);

        if(this.destroyed) return this;

        for(const child of Array.from(targetElement.children)) {
            child.remove();
        }

        if(targetElement) {
            if (this.sandboxMode === "shadow") {
                if (!targetElement.shadowRoot) targetElement.attachShadow({ mode: 'open' });
                targetElement.shadowRoot.replaceChildren(this.content);
            } else {
                targetElement.appendChild(this.content);
            }
        }

        this.state = "ready";

        // await this.#loadJS();
        this.emit("resume", targetElement);
        this.loaded = true;
        return this;
    }

    // TODO: This needs to be worked on
    registerSPAExtension(path, handler) {
        path = website.utils.normalizePath(path || this.#path);
        kernel.SPAExtensions.push([path, handler, this]);
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

        this.replaceContent(N('div', {
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

            try {
                const response = await fetch(this.src, {
                    headers: {
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        // "Akeno-Content-Only": "true" // FIXME: Currently not implemented on backend
                    }
                });

                if (!response.ok) {
                    this.error = response.status;
                    reject(new Error(`${response.status} ${response.statusText}`));
                    return;
                }
    
                const text = await response.text();
                if (this.destroyed) return;
    
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                const newContent = doc.querySelector('#viewport').firstElementChild;
                if (!newContent) {
                    this.error = 404;
                    reject(new Error("404 Not Found"));
                    return;
                }

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
                reject(e);
            }
        });
        return this.loadPromise;
    }

    processAssetsOnNode(element) {
        for (const style of element.querySelectorAll('link[rel="stylesheet"], style')) {
            if(style.href) {
                if(AssetManager.whitelist.has(AssetManager.fuzzKey(style.href || ''))) continue;

                const styleElement = AssetManager.get(style);
                if(styleElement) {
                    this.styles.push(styleElement);
                    style.remove();
                    continue;
                }

                this.styles.push(style);
                AssetManager.registerStyle(style.href, style);
            } else {
                this.styles.push(style);
                style.remove();
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
                AssetManager.registerScript(script.src, scriptElement);
            } else if (script.ownerDocument !== document) {
                let scriptElement = AssetManager.cloneScript(script);
                scriptElement.registeringContext = this;
                this.scripts.push(scriptElement);
                script.remove();
            }
        }
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
        this.emit("suspend");
        return this;
    }

    /**
     * Resumes the context, re-enables styles and re-attaches content.
     * Normally there is no need to call this manually, render() does it automatically.
     */
    resume(){
        this.emit("resume");
        return this;
    }

    /**
     * Destroys the context, unloads assets and removes content.
     * After destroying, the context is no longer usable.
     * WARNING: This will not magically stop any running scripts unless sandboxed as an iframe.
     * You MUST make sure you properly clean up in the "suspend" handler.
     */
    destroy(){
        this.emit("destroy");
        return this;
    }
}


/**
 * Viewport class
 * Represents a viewport in the application where content contexts can be rendered.
 */
class Viewport {
    constructor(name, element, options = {}) {
        this.name = name;
        this.target = element;
        this.current = null;
        this.history = [];
        this.options = options;
        this.target.classList.add("viewport");
        this.target.viewportInstance = this;

        (options.kernel || kernel).viewports.set(this.name, this);
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
        const SPAExtension = options.browserTriggered? null: kernel.SPAExtensions.find(([extpath]) => (path + "/").startsWith(extpath));
        if (SPAExtension) {
            if (SPAExtension[2] !== this.current) {
                // We need to navigate to the base page first
                this.navigate(SPAExtension[2], { browserTriggered: true });
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
                    sandbox: options.sandbox || null
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

        // Full page reload
        // if ((page.requiresReload || options.reload) && path !== this.current?.path) {
        //     // TODO: Display a warning if the website is doing something
        //     return location.href = path;
        // }

        // Suspend old page
        if (old) old.suspend();

        this.target.classList.add("loading");

        // Load and Render new page
        try {
            if (page.error) {
                this.errorPage(page.error);
            } else {
                await page.render(this.target);
            }

            this.current = page;

            if (this.name === 'main') {
                document.title = (page.title && page.title.startsWith("LSTV | "))? page.title: `LSTV | ${page.title || 'Untitled'}`;
                
                if (!options.browserTriggered && !options.initial) {
                    history.pushState({ path }, document.title, page.path);
                }
                website.toolbarClose();
            }

            kernel.log(`Navigated to ${path} in ${this.name}`);
            return true;
        } catch (e) {
            kernel.error("Navigation failed:", e);
            // Restore old page or show error
            if (old) old.render(this.target);
            else this.errorPage(500);
            return false;
        } finally {
            this.target.classList.remove("loading");
        }
    }

    errorPage(status) {
        for(const child of Array.from(this.target.children)) {
            child.remove();
        }

        this.target.appendChild(LS.Create('div', {
            class: 'error_page',
            inner: [
                LS.Create('h1', { textContent: String(status) }),
                { class: 'marqueeBar', inner: [[
                    LS.Create('span', { textContent: website.errorMessages[status] || 'Unexpected error.' }),
                    LS.Create('span', { textContent: website.errorMessages[status] || 'Unexpected error.' }),
                ]]},
                LS.Create('br'),
                LS.Create('br'),
                LS.Create('a', { href: '/', textContent: 'Go back home?' })
            ]
        }));
    }
}


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

    // Constants
    isLocalhost: location.hostname.endsWith("localhost"),
    isEmbedded: window.self !== window.top,
    cdn: "https://cdn.extragon.cloud",

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

            const isAnimated = filename && user.__animated_pfp || filename && filename.endsWith(".webm");
            const src = filename? filename.startsWith("blob:")? filename : website.cdn + '/file/' + filename + (!isAnimated? "?size=" + IMAGE_RESOLUTION: ""): "/assets/image/default.svg";

            const img = N(isAnimated ? "video" : "img", {
                src,
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
                    autoplay: true,
                    loop: true,
                    muted: true
                }
            });

            const wrapper = N("div", {
                class: "profile-picture-wrapper" + (user.username === "admin" ? " secret-frame-experiment" : ""),
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
                    src,
                    alt: "Banner Picture",
                    class: "banner-media",
                    draggable: false,
                    onerror() { this.remove() },
                    ...isAnimated && {
                        autoplay: true,
                        loop: true,
                        muted: true
                    }
                });

                return img;
            } else return null;
        },

        getLinksView(source, args, element) {
            const links = source && (Array.isArray(source) ? source : Array.isArray(source.profileLinks) ? source.profileLinks : []);
            element.style.display = links && links.length ? "block" : "none";

            if (!links || !links.length) return;

            return N("div", {
                class: "links-container",
                inner: links.map(link => {
                    const linkInfo = website.LINKS[link.type.toUpperCase()];

                    return N("a", {
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
        },

        /**
         * A simple switch that triggers a callback when its value changes, but does nothing if it doesn't.
         */
        Switch: class Switch {
            constructor(onSet) {
                this.value = false;
                this.onSet = onSet;
            }

            set(value) {
                if(this.value === value) return;
                this.value = value;
                this.onSet(this.value);
            }

            on() {
                this.set(true);
            }

            off() {
                this.set(false);
            }
        },

        /**
         * Schedules a callback to run on the next animation frame, avoiding multiple calls within the same frame.
         */
        FrameScheduler: class FrameScheduler {
            constructor(callback) {
                this.callback = callback;
                this.queued = false;
            }

            schedule() {
                if(this.queued) return;
                this.queued = true;

                requestAnimationFrame(() => {
                    if(this.queued && this.callback) this.callback();
                    this.queued = false;
                });
            }

            cancel() {
                this.queued = false;
            }
        },

        /**
         * Ensures a callback is only run once.
         */
        RunOnce: class RunOnce {
            constructor(callback) {
                this.callback = callback;
                this.hasRun = false;
            }

            run() {
                if(this.hasRun) return;
                this.hasRun = true;
                this.callback();
                this.callback = null;
            }
        }
    },

    ACCENT_COLORS: ["white", "blue", "pastel-indigo", "lapis", "pastel-teal", "aquamarine", "green", "lime", "neon", "yellow", "orange", "deep-orange", "red", "rusty-red", "pink", "hotpink", "purple", "soap", "burple"],

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
        localStorage.setItem("ls-theme", value);
    },

    get theme(){
        return document.body.getAttribute("ls-theme") || "dark";
    },

    // TODO: Multi-account support
    get userFragment() {
        console.warn("website.userFragment used.");
        return kernel.userFragment;
    },

    // NOTE: This is a cached result, and so may not be up to date. Wherever you can, use await kernel.auth.isLoggedIn(); instead.
    isLoggedIn: false,

    isToolbarOpen: false,

    // Utility functions

    toolbarOpen(id, toggle, button) {
        if(website.headerWindowCurrent == id && website.isToolbarOpen) {
            if(toggle) website.toolbarClose();
            return;
        }

        const view = document.getElementById(id);
        if(!view) return;

        const oldElement = O(".toolbar.visible");

        view.style.transition = (!website.isToolbarOpen || !oldElement)? "none" : "";

        LS.Animation.slideInToggle(view, oldElement);

        if (!website.isToolbarOpen) LS.Animation.fadeIn(O("#toolbars"), null, "up");
        website.isToolbarOpen = true;

        LS.invoke("toolbar-open", id);

        website.headerWindowCurrent = id;

        Q("#headerButtons > button.open").forEach(element => element.classList.remove("open"));
        if (button) button.classList.add("open");
    },

    toolbarClose() {
        if(!website.isToolbarOpen) return;

        LS.Animation.fadeOut(O("#toolbars"), null, "down");
        LS.invoke("toolbar-close");

        website.isToolbarOpen = false;

        Q("#headerButtons > button.open").forEach(element => element.classList.remove("open"));
    },

    showLoginToolbar(toggle = false) {
        O("#accountsButton").focus();
        setTimeout(() => {
            if(!toggle && website.isToolbarOpen && website.headerWindowCurrent === "toolbarLogin") return;

            website.loginTabs.set(website.isLoggedIn? "account": "default", true);
            website.toolbarOpen("toolbarLogin", toggle, O("#accountsButton"));

            if(!website.isLoggedIn) setTimeout(() => {
                O("#loginPopup")?.querySelector("button,input")?.focus();
            }, 0);
        }, 0);
    },

    /**
     * Requests scoped access. This is required to access the website APIs.
     * @param {HTMLScriptElement|string} script - The script tag or unique identifier.
     * @param {Function} callback - The initialization callback function.
     * @deprecated
     */
    register(script, callback) {
        return kernel.registerModule(script, callback);
    },

    /**
     * Helper that calls back immediately when the user data is loaded, and subsequently whenever it changes.
     * Reliable method to ensure up-to-date user data at any point without race conditions.
     * TODO: Move to isolated contexts to avoid leaking the user fragment.
     * @param {Function} callback - The function to call with user data updates.
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
}

website.events = new LS.EventHandler(website);
window.website = website;


/**
 * Kernel class
 * Main application kernel, handles global state, navigation, authentication, and content contexts.
 */
const kernel = new class Kernel extends LoggerContext {
    version = KERNEL_VERSION;

    contexts = new Map();
    viewports = new Map();
    pageCache = new Map();

    aliasMap = new Map();

    queryParams = LS.Util.params();
    userFragment = LS.Reactive.wrap("user", {});

    SPAExtensions = [];

    /**
     * Auth manager
     */
    auth = new class Auth extends LS.EventHandler {
        constructor() {
            super();

            this.iframeOrigin = `https://auth.extragon.${website.isLocalhost? "localhost": "cloud"}`;
            this.iframeURL = `${this.iframeOrigin}/bridge.html`;

            this.ready = false;
            this.loading = false;
            this.startupQueue = [];
            this.iframe = null;
            this.callbacks = new Map();

            this.logger = new LoggerContext("auth");

            this.nonce = [...crypto.getRandomValues(new Uint32Array(4))].map(i => i.toString(36)).join("-");

            this.hello = false;
            window.addEventListener('message', e => {
                if (!this.hello) {
                    if (e.data.data.initialized) {
                        this.hello = true;
                        this.logger.info('Auth bridge initialized.');
                        return;
                    } else return;
                }

                if (e.origin !== this.iframeOrigin) return;

                if (e.data.event && !e.data.id) {
                    this.emit(e.data.event, [e.data.data]);
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

            this.loading = true;
            this.iframe = document.createElement('iframe');
            this.iframe.sandbox = "allow-scripts allow-same-origin";
            this.iframe.src = this.iframeURL;
            this.iframe.style.display = 'none';
            document.body.appendChild(this.iframe);

            this.iframe.onload = () => {
                this.iframe.contentWindow.postMessage({ type: 'init', nonce: this.nonce }, this.iframeOrigin);
                this.ready = true;
                if (callback) callback();
                if (this.startupQueue.length > 0) {
                    this.startupQueue.forEach(cb => cb());
                    this.startupQueue = [];
                }
                this.loading = false;

                setTimeout(() => {
                    if (!this.hello) {
                        this.ready = false;
                        this.logger.error('Auth iframe failed to respond.');
                        LS.Toast.show("Authentication bridge failed to respond - account features will not work.", { accent: "red" });
                    }
                }, 1000);
            };
    
            this.iframe.onerror = error;
        }

        postMessage(action, data = {}, callback) {
            return new Promise((resolve, reject) => {
                const id = Math.random().toString(36).substring(2);
                this.callbacks.set(id, { callback, resolve, reject });
                this.#getFrame((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    this.iframe.contentWindow.postMessage({ action, id, ...data, nonce: this.nonce }, this.iframeOrigin);
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

        getUserFragment(callback) {
            return this.postMessage('getUserFragment', null, callback);
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
        this.events = new LS.EventHandler(this);

        // Watch for device theme changes
        LS.Color.autoScheme();

        if(localStorage.hasOwnProperty("ls-accent")){
            const accent = localStorage.getItem("ls-accent");

            if(accent.startsWith("#")) {
                LS.Color.update('custom', accent);
                LS.Color.setAccent('custom');
            } else {
                LS.Color.setAccent(accent);
            }
        }

        website.viewport = this.viewport = new Viewport('main', document.getElementById('viewport'), {
            kernel: this
        });

        this.ttl = Date.now() - window.__loadTime;
        this.log('Kernel initialized, version %c' + this.version + '%c, time since first load: ' + this.ttl + 'ms', 'font-weight:bold', 'font-weight:normal');

        LS.Reactive.registerType("ProfilePicture", website.views.getProfilePictureView);
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

            if(args[0] === "style") {
                if(profile && value) {
                    profile.setAttribute("profile-style", value);
                } else {
                    profile.removeAttribute("profile-style");
                }
            }

            if (args[0] === "fullscreen-banner") {
                profile.classList.toggle("fullscreen-banner", !!user.fullscreen_banner);
            }

            return null;
        });

        LS.Color.on("theme-changed", () => {
            O("#themeButton i").className = "bi-" + (website.theme == "light"? "moon-stars-fill": "sun-fill");
        });

        this.auth.on("user-updated", (patch) => {
            if (patch) {
                Object.assign(this.userFragment, patch);
            }
        });

        const originalState = location.pathname;

        // Event listener for back/forward buttons (for single-page app behavior)
        window.addEventListener('popstate', function (event) {
            const href = event.state? event.state.path: originalState;
            kernel.viewport.navigate(href, { pushState: false });
        });

        window.addEventListener('click', function (event) {
            const targetElement = event.target.closest("a");

            if (targetElement && targetElement.tagName === 'A') {
                if(targetElement.hasAttribute("target")) return;
                if(targetElement.href.endsWith("#")) return event.preventDefault();

                const link = targetElement.href;
                let href = targetElement.getAttribute('href');

                if(link.startsWith(origin) && !link.endsWith("?") && !link.startsWith(origin + ":")){
                    if(href.startsWith(origin)) href = href.substring(origin.length);
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
                }
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            website.container = this.container = document.getElementById('app');
            website.viewportElement = this.viewportElement = this.viewport.target;

            const context = this.registerPage(location.pathname, {
                element: this.viewportElement.firstElementChild,
                title: document.title,
                scripts: AssetManager._initialExternalAssets.scripts,
                styles: AssetManager._initialExternalAssets.styles,
                executeScripts: false // Initial page scripts are already executed
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
                    this.registerModule(initEntry.script, initEntry.callback, context);
                }
                window.__init = null;
            }

            this.loadUser();
            this.#initializeToolbars();
            this.#initializePings();

            // Display content
            document.querySelector(".loaderContainer").style.display = "none";
            website.container.style.display = "flex";
        });

        // --- Debug ONLY ---
        if (website.isLocalhost) {
            window.kernel = this;
            window.auth = this.auth;
            window.website = website;
            window.AssetManager = AssetManager;
        }

        // TODO:FIXME: This should only allow non-authenticated access
        website.fetch = this.auth.fetch.bind(this.auth);

        if (!website.isEmbedded) this.#initializeCommandPalette();
        website.emit("ready");
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
        const page = this.pageCache.get(path) || this.aliasMap.get(path) || (this.SPAExtensions.find(([extpath]) => (path + "/").startsWith(extpath + "/"))?.[2]);
        return page || null;
    }

    /**
     * Register a module/script scope with the application. This scope can request permissions and access APIs.
     * @param {*} script Script tag or unique identifier
     * @param {*} callback Initialization callback
     */
    registerModule(script, callback, context = null) {
        if (window.__init !== null && !this.__loaded) {
            // Still initializing
            window.__init.push({ script, callback });
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
                        if (viewport.currentPage && viewport.currentPage.content.contains(script)) {
                            context = viewport.currentPage;
                        }
                        break;
                    }
                }
            }
        }

        if (context) {
            this.log("Registered module for context", context.path || context.id);
            if (callback) callback(context, context.content);
        } else {
            // Fallback: Use current page if we can't determine context
            this.warn("Registering module to global/unknown context", script);
            if (callback) callback(kernel.viewport.current, kernel.viewport.current?.content);
        }
    }

    async loadUser() {
        this.log("Loading user data");

        let isLoggedIn = await this.auth.isLoggedIn();

        if (isLoggedIn) {
            try {
                const user = await this.auth.getUserFragment();
                Object.assign(this.userFragment, user);
            } catch (error) {
                console.error("Failed to load user fragment:", error);
                isLoggedIn = false;
            }
        } else {
            this.userFragment = LS.Reactive.wrap("user", {});
        }

        O("#accountsButton").disabled = false;
        O("#accountsButton").ls_tooltip = isLoggedIn ? "Manage profiles": "Log in";

        website.events.emit("user-changed", [ isLoggedIn, this.userFragment ]);
        // website.events.emit("user-loaded", [ isLoggedIn ]);
        website.events.completed("user-loaded");
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

    #initializeCommandPalette() {
        const topBar = O("#topOverlay");
        const paletteBar = O("#commandPaletteBar");
        const paletteContainer = O("#commandPalette");
        const terminalContainer = O("#commandTerminal");
        const commandPaletteButton = O("#commandPaletteButton");
        const terminalOutput = terminalContainer.querySelector(".terminal-output");

        const paletteLogger = new LoggerContext("Command Palette");
        const palette = new CommandPalette({
            wrapperElement: paletteContainer,
            menuElement: paletteContainer.querySelector(".completion-menu"),
            iconElement: paletteContainer.querySelector(".command-icon"),
            textDisplayElement: paletteContainer.querySelector(".command-text"),
            hintElement: paletteContainer.querySelector(".command-hint"),
            inputElement: paletteContainer.querySelector(".command-input"),
            terminalOutput: terminalOutput,

            fontWidth: 9.6 * 1.2,

            shortcuts: ['ctrl+shift+p', 'ctrl+k'],

            onClose(){
                LS.Animation.fadeOut(topBar, 300, "down");
            },

            onOpen(){
                LS.Animation.fadeIn(topBar, 300, "up");
            },

            logger: paletteLogger
        });

        commandPaletteButton.onclick = () => {
            website.toolbarClose();
            palette.open();
        };

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
            log: palette.log.bind(palette)
        }

        this.terminalWriter = terminalWriter;
        paletteLogger.writer = terminalWriter;

        paletteBar.querySelector("button").onclick = () => {
            palette.close();
        };

        palette.register([
            {
                name: "set-accent",
                icon: "bi-palette2",
                description: "Set an accent color",

                onCalled(color) {
                    if(color.startsWith("#")) {
                        LS.Color.update('custom', color);
                        LS.Color.setAccent('custom');
                    } else {
                        LS.Color.setAccent(color);
                    }

                    "white" === color ? localStorage.removeItem("ls-accent") : localStorage.setItem("ls-accent", color)
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
                name: "clear",
                icon: "bi-trash",
                alias: ["clear-terminal", "cls"],
                description: "Clear the terminal output",
                onCalled() { terminalOutput.innerHTML = "" }
            },

            {
                name: "kernel-info",
                alias: ["kernel-version", "version"],
                icon: 'bi-info',
                description: "Show kernel information",
                async onCalled() {
                    terminalWriter.log(
                        `%clstv.space%c kernel`,
                        "color:var(--accent);font-weight:bold;font-size:1.2em",
                        "color:inherit;font-weight:bold;font-size:1.2em"
                    );
                    terminalWriter.log(
                        `%cVersion:%c ${kernel.version}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cLS version:%c ${LS.version}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cPages loaded:%c ${kernel.pageCache.size}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cViewports:%c ${kernel.viewports.size}`,
                        "color:var(--accent);font-weight:bold", "color:inherit"
                    );
                    terminalWriter.log(
                        `%cUser loaded:%c ${await kernel.auth.isLoggedIn() ? "Yes" : "No"}`,
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
                        description: "Notification settings",
                        children: [
                            {
                                name: "enable",
                                icon: "bi-bell-fill",
                                description: "Enable notifications",
                                onCalled() { console.log("Notifications enabled"); }
                            },
                            {
                                name: "disable",
                                icon: "bi-bell-slash",
                                description: "Disable notifications",
                                onCalled() { console.log("Notifications disabled"); }
                            }
                        ]
                    },

                    {
                        name: "privacy",
                        icon: "bi-shield-lock",
                        description: "Privacy settings",
                        children: [
                            {
                                name: "set-mode",
                                icon: "bi-incognito",
                                description: "Set privacy mode",
                                onCalled(mode) { console.log("Privacy mode:", mode); },
                                inputs: [
                                    {
                                        name: "mode",
                                        type: "list",
                                        description: "Privacy mode",
                                        list: [
                                            { name: "Public", value: "public", icon: "bi-unlock" },
                                            { name: "Friends", value: "friends", icon: "bi-people" },
                                            { name: "Private", value: "private", icon: "bi-lock" }
                                        ]
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
                name: "user",
                icon: "bi-person",
                description: "User related commands",
                children: [
                    {
                        name: "profile",
                        icon: "bi-person-badge",
                        description: "Show user profile",
                        onCalled(username) { console.log("Profile for", username); },
                        inputs: [
                            { name: "username", type: "string", description: "Username to lookup", icon: "bi-at" }
                        ]
                    },
                    {
                        name: "set-color",
                        icon: "bi-droplet",
                        description: "Set accent color",
                        onCalled(color) { console.log("Accent color set to", color); },
                        inputs: [
                            { name: "color", type: "color", description: "Pick a color" }
                        ]
                    },
                    {
                        name: "set-avatar",
                        icon: "bi-image",
                        description: "Set profile picture",
                        onCalled(file) { console.log("Avatar file:", file); },
                        inputs: [
                            { name: "avatar", type: "file", description: "Upload an image" }
                        ]
                    },
                    {
                        name: "set-active",
                        icon: "bi-toggle-on",
                        description: "Set user active status",
                        inputs: [
                            { name: "active", type: "boolean", description: "Active?" }
                        ]
                    }
                ]
            },
            {
                name: "math",
                icon: "bi-calculator",
                description: "Math operations",
                children: [
                    {
                        name: "add",
                        icon: "bi-plus",
                        description: "Add two numbers",
                        onCalled(a, b) { terminalWriter.log("Sum:", a + b); },
                        inputs: [
                            { name: "a", type: "number", description: "First number" },
                            { name: "b", type: "number", description: "Second number" }
                        ]
                    },
                    {
                        name: "subtract",
                        icon: "bi-dash",
                        description: "Subtract two numbers",
                        onCalled(a, b) { terminalWriter.log("Difference:", a - b); },
                        inputs: [
                            { name: "a", type: "number", description: "First number" },
                            { name: "b", type: "number", description: "Second number" }
                        ]
                    },
                    {
                        name: "multiply",
                        icon: "bi-x",
                        description: "Multiply two numbers",
                        onCalled(a, b) { terminalWriter.log("Product:", a * b); },
                        inputs: [
                            { name: "a", type: "number", description: "First number" },
                            { name: "b", type: "number", description: "Second number" }
                        ]
                    },
                    {
                        name: "divide",
                        icon: "bi-slash",
                        description: "Divide two numbers",
                        onCalled(a, b) { 
                            if (b === 0) terminalWriter.log("Error: Division by zero");
                            else terminalWriter.log("Quotient:", a / b); 
                        },
                        inputs: [
                            { name: "a", type: "number", description: "Dividend" },
                            { name: "b", type: "number", description: "Divisor" }
                        ]
                    },
                    {
                        name: "power",
                        icon: "bi-caret-up-fill",
                        description: "Raise a number to a power",
                        onCalled(a, b) { terminalWriter.log(`${a} ^ ${b} =`, Math.pow(a, b)); },
                        inputs: [
                            { name: "a", type: "number", description: "Base" },
                            { name: "b", type: "number", description: "Exponent" }
                        ]
                    },
                    {
                        name: "sqrt",
                        icon: "bi-square-root",
                        description: "Square root",
                        onCalled(a) { 
                            if (a < 0) terminalWriter.log("Error: Negative input");
                            else terminalWriter.log(`√${a} =`, Math.sqrt(a)); 
                        },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "abs",
                        icon: "bi-arrow-up-right",
                        description: "Absolute value",
                        onCalled(a) { terminalWriter.log(`|${a}| =`, Math.abs(a)); },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "round",
                        icon: "bi-circle",
                        description: "Round to nearest integer",
                        onCalled(a) { terminalWriter.log(`round(${a}) =`, Math.round(a)); },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "floor",
                        icon: "bi-arrow-down",
                        description: "Floor (round down)",
                        onCalled(a) { terminalWriter.log(`floor(${a}) =`, Math.floor(a)); },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "ceil",
                        icon: "bi-arrow-up",
                        description: "Ceil (round up)",
                        onCalled(a) { terminalWriter.log(`ceil(${a}) =`, Math.ceil(a)); },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "sin",
                        icon: "bi-activity",
                        description: "Sine (degrees)",
                        onCalled(a) { terminalWriter.log(`sin(${a}°) =`, Math.sin(a * Math.PI / 180)); },
                        inputs: [
                            { name: "a", type: "number", description: "Degrees" }
                        ]
                    },
                    {
                        name: "cos",
                        icon: "bi-activity",
                        description: "Cosine (degrees)",
                        onCalled(a) { terminalWriter.log(`cos(${a}°) =`, Math.cos(a * Math.PI / 180)); },
                        inputs: [
                            { name: "a", type: "number", description: "Degrees" }
                        ]
                    },
                    {
                        name: "tan",
                        icon: "bi-activity",
                        description: "Tangent (degrees)",
                        onCalled(a) { terminalWriter.log(`tan(${a}°) =`, Math.tan(a * Math.PI / 180)); },
                        inputs: [
                            { name: "a", type: "number", description: "Degrees" }
                        ]
                    },
                    {
                        name: "log",
                        icon: "bi-graph-up",
                        description: "Logarithm base 10",
                        onCalled(a) { 
                            if (a <= 0) terminalWriter.log("Error: Non-positive input");
                            else terminalWriter.log(`log10(${a}) =`, Math.log10(a)); 
                        },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "ln",
                        icon: "bi-graph-up-arrow",
                        description: "Natural logarithm",
                        onCalled(a) { 
                            if (a <= 0) terminalWriter.log("Error: Non-positive input");
                            else terminalWriter.log(`ln(${a}) =`, Math.log(a)); 
                        },
                        inputs: [
                            { name: "a", type: "number", description: "Number" }
                        ]
                    },
                    {
                        name: "exp",
                        icon: "bi-lightning",
                        description: "Exponential (e^x)",
                        onCalled(a) { terminalWriter.log(`e^${a} =`, Math.exp(a)); },
                        inputs: [
                            { name: "a", type: "number", description: "Exponent" }
                        ]
                    },
                    {
                        name: "pi",
                        icon: "bi-circle-half",
                        description: "Value of π",
                        onCalled() { terminalWriter.log("π =", Math.PI); },
                        inputs: []
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
                name: "toggle-feature",
                icon: "bi-lightning",
                description: "Toggle a feature on/off",
                onCalled(enabled) { console.log("Feature enabled:", enabled); },
                inputs: [
                    { name: "enabled", type: "boolean", description: "Enable feature?" }
                ]
            },
            {
                name: "upload-file",
                icon: "bi-upload",
                description: "Upload a file",
                onCalled(file) { console.log("File uploaded:", file); },
                inputs: [
                    { name: "file", type: "file", description: "Choose a file" }
                ]
            },
            {
                name: "choose-option",
                icon: "bi-list-check",
                description: "Choose from a list",
                onCalled(option) { console.log("Option chosen:", option); },
                inputs: [
                    {
                        name: "option",
                        type: "list",
                        description: "Pick one",
                        list: [
                            { name: "Alpha", value: "alpha", icon: "bi-1-circle", description: "First option" },
                            { name: "Beta", value: "beta", icon: "bi-2-circle", description: "Second option" },
                            { name: "Gamma", value: "gamma", icon: "bi-3-circle", description: "Third option" }
                        ]
                    }
                ]
            },
            {
                name: "dynamic-children",
                icon: "bi-diagram-3",
                description: "Command with dynamic children",
                children: () => {
                    const items = [];
                    for(let i = 1; i <= 5; i++) {
                        items.push({
                            name: `item-${i}`,
                            icon: "bi-file-earmark",
                            description: `Dynamic item number ${i}`,
                            onCalled() { console.log(`Dynamic item ${i} selected`); }
                        });
                    }
                    return items;
                }
            },
            {
                name: "dynamic-async-children",
                icon: "bi-hourglass-split",
                description: "Command with async dynamic children",
                children: () => new Promise((resolve) => {
                    setTimeout(() => {
                        const items = [];
                        for(let i = 1; i <= 3; i++) {
                            items.push({
                                name: `async-item-${i}`,
                                icon: "bi-file-earmark-text",
                                description: `Async dynamic item number ${i}`,
                                onCalled() { console.log(`Async dynamic item ${i} selected`); }
                            });
                        }
                        resolve(items);
                    }, 500);
                })
            }
        ]);
    }

    #initializeToolbars() {
        const nav = O("#app > nav");
        const moreButton = O("#moreButton");
        const navPadding = 28 + 5;
        const gap = 10;

        const collapseItems = new website.utils.FrameScheduler(() => {
            const availableSpace = nav.clientWidth - navPadding - moreButton.clientWidth - (nav.firstElementChild?.clientWidth || 0);

            let takenSpace = 0;
            for (const i of Q("#headerButtons > *")) {
                if(i === moreButton) continue;

                const w = i.clientWidth + gap;
                takenSpace += w;

                if(takenSpace > availableSpace) {
                    i.classList.add("hidden");
                } else {
                    i.classList.remove("hidden");
                }
            }

            moreButton.style.display = (availableSpace + moreButton.clientWidth) < takenSpace ? "inline-flex" : "none";
            resizeMessageSwitch.set(window.innerHeight < 100 || window.innerWidth < 100);
        });

        const resizeMessageContainer = document.getElementById("resizeMessage");
        const resizeMessageSwitch = new website.utils.Switch((on) => {
            if(on) {
                resizeMessageContainer.style.display = "flex";
                website.container.style.display = "none";
            } else {
                resizeMessageContainer.style.display = "none";
                website.container.style.display = "flex";
            }
        });

        collapseItems.schedule();
        addEventListener("resize", () => {
            collapseItems.schedule();
        });

        O("#accountsButton").on("click", () => website.showLoginToolbar(true));

        O("#logOutButton").on("click", function (){
            kernel.auth.logout(() => {
                LS.Toast.show("Logged out successfully.", {
                    timeout: 2000
                });
                website.toolbarClose();
                // location.reload();

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
                website.toolbarClose();
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

        O("#appsButton").on("click", function (){
            website.toolbarOpen("toolbarApps", true, this);
        })

        O("#themeButton").on("click", function (){
            website.toolbarOpen("toolbarTheme", true, this);
        })

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
                class: "accentButton",
                inner: accent === "white" ? N("i", { class: "bi-x-circle-fill" }) : null,
                accent,
                tooltip: accent === "white" ? "Reset": (accent.charAt(0).toUpperCase() + accent.slice(1)),
                onclick(){
                    LS.Color.setAccent(accent);

                    if(accent === "white") {
                        localStorage.removeItem("ls-accent");
                    } else {
                        localStorage.setItem("ls-accent", accent);
                    }
                }
            }));

            O("#accentButtons").get("input[type=color]").on("input", function (){
                LS.Color.update('custom', this.value);
                LS.Color.setAccent('custom');
                localStorage.setItem("ls-accent", this.value);
            });
        }

        O("#assistantButton").on("click", (event) => {
            website.toolbarOpen("toolbarAssistant", true, event.currentTarget);

            if(!window.__assistantLoading) {
                window._assistantCallback = null;
                window.__assistantLoading = true;

                setTimeout(async () => {
                    M.LoadScript("/~/assets/js/assistant.js" + window.cacheKey, (error) => {
                        if(error || typeof window._assistantCallback !== "function") {
                            LS.Toast.show("Sorry, assistant failed to load. Please try again later.")
                            return;
                        }
        
                        window._assistantCallback(website, this.auth);
                    })
                }, 0);
            }
        })

        website.viewportElement.on("click", () => {
            website.toolbarClose();
        })
    }

    /**
     * Anonymous statistics pings, helps to check for connectivity, check for updates from the server & receive remote updates, etc.
     * Do not disable unless you have a *very* good reason to, this is *not* invasive telemetry - privacy is fully respected (https://lstv.space/privacy-policy), and *nothing* is ever shared with 3rd parties for any reason.
     * 
     * Timings are rounded to reduce precision for privacy.
     */
    #initializePings() {
        const PING_URL = '/ping';
        const SESSION_ID = website.utils.generateIdentifier(); // True random ID
        let current_interval = 15000, first = true;

        const sendPing = (beacon = false) => {
            const STATS_DISABLED = localStorage.getItem("DISABLE_STATS") === "true";

            const data = JSON.stringify(!STATS_DISABLED? {
                sessionID: SESSION_ID,
                timestamp: Date.now(),
                kernel: KERNEL_VERSION,
                pagesLoaded: kernel.pageCache.size,
                viewports: kernel.viewports.size,
                currentPage: kernel.viewport.current?.path, // Does not include query or fragments, neither things like the content being viewed (eg. /post/123 will likely show up as just /post))
                userLoggedIn: website.isLoggedIn, // No identifiable info, just yes/no
                uptimeMs: Math.round(Date.now() - window.__loadTime),

                ...first ? {
                    platform: navigator.platform,
                    loadTime: Math.round(this.ttl),
                    ttfp: Math.round(Date.now() - window.__loadTime),
                    origin: location.origin,
                    performanceMode: window.LOW_PERFORMANCE_MODE ? "low" : "normal", // User-set, does not relate to hardware,
                    ls_version: LS.version
                } : {}
            }: {
                sessionID: SESSION_ID,
                kernel: KERNEL_VERSION,
                uptimeMs: Math.round(Date.now() - window.__loadTime),
                statsDisabled: true,

                ...first ? {
                    ttfp: Math.round(Date.now() - window.__loadTime)
                } : {}
            });

            if(beacon) {
                // Sent when ending a session naturally
                data.quit = true;
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
                    });
                } else {
                    current_interval = Math.max(current_interval - 5000, 10000);
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
}


} catch (e) { console.error("Fatal error during app initialization:", e); window.__loadError('<h3 style="margin:40px 20px">The application failed to load. Please try again later. Make sure you are on an up-to-date browser.</h3><br><button onclick=location.reload()>Reload</button>') }