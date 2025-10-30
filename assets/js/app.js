window.addEventListener("DOMContentLoaded", async () => {
    class Page extends LS.EventHandler {
        constructor(path, options = {}){
            super();

            this.path = app.util.normalizePath(path);
            this.options = options;

            if(path === "/" || path === "/login" || path === "/sign-up") {
                this.requiresReload = true;
            }

            app.pages.set(path, this);
        }

        contentRequested(){
            if(this.contentElement){
                this.contentElement.class("page")
                this.contentElement.pageObject = this
                return true
            } else return false
        }

        registerSPAExtension(path, handler) {
            SPAExtensions.push([path || this.path, handler]);
        }
    }

    class RemotePage extends Page {
        constructor(path, options = {}){
            super(path, options);
        }

        async contentRequested(){
            if(!this.contentElement) {
                let response;

                try {
                    response = await fetch(this.path, {
                        headers: {
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Akeno-Content-Only": "true"
                        }
                    });

                    this.contentElement = N("div", {
                        class: "page",
                        innerHTML: await response.text()
                    });

                    this.contentElement.pageObject = this;

                    for(let script of this.contentElement.getAll("script")) {
                        if(script.parentElement !== this.contentElement) return;

                        const newScript = script.src
                            ? N("script", { src: script.src })
                            : N("script", { textContent: script.textContent });

                        const identifier = app.util.generateIdentifier();
                        newScript.setAttribute("data-identifier", identifier);

                        trustedScripts.add(identifier);
                        this.contentElement.add(newScript);
                        script.remove();
                    }

                    this.contentElement.getAll("script").forEach(script => {
                        if(script.parentElement !== this.contentElement) return;

                        if(script.hasAttribute("data-identifier")) {
                            trustedScripts.add(script.getAttribute("data-identifier"));
                        }
                    })

                    this.contentElement.getAll('link[rel="stylesheet"]').forEach(link => {
                        if(link.parentElement !== this.contentElement) return;

                        this.contentElement.add(N("link", { href: link.href, rel: "stylesheet" }));
                        link.remove();
                    });

                } catch (error) {
                    console.error(error);
                    return false;
                }

                // TODO: An error page here
                if(response.status > 399){
                    console.log(response.status);
                    return false
                }
            }

            return true
        }
    }

    let app = {
        isToolbarOpen: false,

        userFragment: LS.Reactive.wrap("user", {}),

        isLoggedIn: false,

        async setPage(page, options = {}) {
            let path = typeof page === "string"? app.util.normalizePath(page): page.path;

            if (typeof page === "string") {
                page = app.pages.get(path) || new RemotePage(path);
            }

            // Redirect completely to a new context instead of loading dynamically
            if ((app.page.requiresReload || page.requiresReload || options.reload) && path !== app.page.path) {
                return location.href = path;
            }

            if (!options.browserTriggered && app.currentPage === path) {
                return true;
            }

            console.log("[app] Changed page to", path);
            const success = await page.contentRequested(options.refresh);

            app.currentPage = page.path;
            document.title = `LSTV | ${page.title || "Web"}`;

            app.viewport.getAll("style").forEach(style => style.disabled = true);

            if (!options.browserTriggered) {
                history.pushState({ path }, document.title, path);
            }

            app.viewport.replaceChildren(page.contentElement);
            if (!success) return false;
        },

        module(script, init) {
            // if(!script || !script.hasAttribute("data-identifier")) {
            //     console.error("Invalid module script provided");
            //     return;
            // }

            // const identifier = script.getAttribute("data-identifier");

            // if(trustedScripts.has(identifier)) {
            //     trustedScripts.delete(identifier);
                init(app, app.page, app.page.contentElement);
            // } else {
            //     console.warn(`Module with identifier ${identifier} is not trusted or has already been loaded.`);
            // }
        },

        fetch(url, options = {}, callback) {
            return this.auth.fetch(url, options, callback);
        },

        handleSPAExtension(href, extension, targetElement) {
            const [path, handler] = extension;
            if (typeof handler !== "function") {
                return;
            }

            if (targetElement) {
                history.pushState({ path: href }, document.title, href);
            }

            const extendedPath = app.util.normalizePath(href.replace(path, ""), false);
            handler(extendedPath, targetElement);
        }
    }

    window.addEventListener('click', function (event) {
        const targetElement = event.target.closest("a");

        if (targetElement && targetElement.tagName === 'A') {
            if(targetElement.hasAttribute("target")) return;
            if(targetElement.href.endsWith("#")) return event.preventDefault();

            const link = targetElement.href;
            const href = targetElement.getAttribute('href');

            if(link.startsWith(origin) && !link.endsWith("?") && !link.startsWith(origin + ":")){
                const SPAExtension = SPAExtensions.find(([path]) => (href + "/").startsWith(path));
                if (SPAExtension) {
                    event.preventDefault();
                    if(location.href === link) {
                        return;
                    }

                    app.handleSPAExtension(href, SPAExtension, targetElement);
                } else {
                    // Temporarily disabled
                    // event.preventDefault();
                    // app.setPage(href);
                    // app.toolbarClose();
                }

            }
        }
    });

    if(!isLocalhost){
        // Only give the global context limited access
        window.app = {
            module: app.module,

            loginTabs: app.loginTabs,

            cdn: app.cdn,

            on: app.events.on.bind(app.events),
            once: app.events.once.bind(app.events),
            off: app.events.off.bind(app.events),

            get theme() {
                return app.theme;
            },

            set theme(value) {
                app.theme = value;
            }
        };
    } else {
        // Debugging only!
        window.app = app;
    }


    // TODO: Separate this, currently some parts rely on it
    app.auth = this.auth;

    // Load the initial page
    const page = new Page(location.pathname);
    app.currentPage = page.path;

    // TODO: Use document collection instead
    page.contentElement = O("main > div");

    app.setPage(page, { browserTriggered: true });

    // Display content
    document.querySelector(".loaderContainer").style.display = "none";
    app.container.style.display = "flex";
})