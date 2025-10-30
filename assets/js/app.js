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
        set theme(value){
            if(!value) return;

            LS.Color.setTheme(value);
            localStorage.setItem("ls-theme", value);
        },

        get theme(){
            return document.body.getAttribute("ls-theme") || "dark";
        },

        isToolbarOpen: false,

        toolbarOpen(id, toggle, button) {
            if(app.headerWindowCurrent == id && app.isToolbarOpen) {
                if(toggle) app.toolbarClose();
                return;
            }

            const view = document.getElementById(id);
            if(!view) return;

            const oldElement = O(".toolbar.visible");

            view.style.transition = (!app.isToolbarOpen || !oldElement)? "none" : "";

            LS.Animation.slideInToggle(view, oldElement);

            if (!app.isToolbarOpen) LS.Animation.fadeIn(O("#toolbars"), null, "up");
            app.isToolbarOpen = true;

            LS.invoke("toolbar-open", id);

            app.headerWindowCurrent = id;

            Q("#headerButtons > button.open").forEach(element => element.classList.remove("open"));
            if (button) button.classList.add("open");
        },

        toolbarClose() {
            if(!app.isToolbarOpen) return;

            LS.Animation.fadeOut(O("#toolbars"), null, "down");
            LS.invoke("toolbar-close");

            app.isToolbarOpen = false;

            Q("#headerButtons > button.open").forEach(element => element.classList.remove("open"));
        },

        userFragment: LS.Reactive.wrap("user", {}),

        isLoggedIn: false,

        async loadUser() {
            let isLoggedIn = await auth.isLoggedIn();

            if (isLoggedIn) {
                try {
                    const user = await auth.getUserFragment();
                    Object.assign(app.userFragment, user);
                } catch (error) {
                    console.error("Failed to load user fragment:", error);
                    isLoggedIn = false;
                }
            } else {
                LS.Reactive.wrap("user", {});
            }

            app.isLoggedIn = isLoggedIn;
            O("#accountsButton").disabled = false;
            O("#accountsButton").ls_tooltip = isLoggedIn ? "Manage profiles": "Log in";

            app.events.completed("user-loaded");
        },

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

        loginTabs: new LS.Tabs(O("#toolbarLogin"), {
            list: false,
            selector: ".login-toolbar-page",
            styled: false
        }),

        fetch(url, options = {}, callback) {
            return auth.fetch(url, options, callback);
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

    app.events = new LS.EventHandler(app);

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

    const originalState = location.pathname;

    // Event listener for back/forward buttons (for single-page app behavior)
    window.addEventListener('popstate', function (event) {
        const href = event.state? event.state.path: originalState;

        const SPAExtension = SPAExtensions.find(([path]) => (href + "/").startsWith(path));
        if (SPAExtension) {
            app.handleSPAExtension(href, SPAExtension, null);
        } else {
            // Temporarily disabled
            // app.setPage(href, { browserTriggered: true });
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
    app.auth = auth;

    LS.Color.on("theme-changed", () => {
        O("#themeButton i").className = "bi-" + (app.theme == "light"? "moon-stars-fill": "sun-fill");
    });

    // Load the initial page
    const page = new Page(location.pathname);
    app.currentPage = page.path;

    // TODO: Use document collection instead
    page.contentElement = O("main > div");

    app.setPage(page, { browserTriggered: true });

    // Display content
    document.querySelector(".loaderContainer").style.display = "none";
    app.container.style.display = "flex";

    app.loadUser();

    auth.on("user-updated", (patch) => {
        if (patch) {
            Object.assign(app.userFragment, patch);
        }
    });

    O("#accountsButton").on("click", function (){
        app.loginTabs.set(app.isLoggedIn? "account": "default", true);
        app.toolbarOpen("toolbarLogin", true, this);
    });

    O("#logOutButton").on("click", function (){
        auth.logout(() => {
            LS.Toast.show("Logged out successfully.");
            app.toolbarClose();
            location.reload();
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
        location.replace(app.originalQuery.continue || ((location.pathname.startsWith("/login") || location.pathname.startsWith("/sign-up"))? "/": location.href));
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

        auth.login(username, password, (error, result) => {
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
        const email = O("#regEmail").value;
        const username = O("#regUsername").value.toLowerCase();
        const password = O("#regPassword").value;
        const displayName = event.target.querySelector("input[name='displayname']").value;

        if (!email || !username || !password) {
            app.loginTabs.set('register');
            displayLoginError("All fields are required");
            return;
        }

        auth.register({ email, username, password, displayname: displayName || null }, (error, result) => {
            if (error) {
                app.loginTabs.set('register');
                console.log(error, (error.code === 4 || error.code === 5)? O("#regEmail"): (error.code === 3 || error.code === 6)? O("#regUsername"): error.code === 7? O("#regPassword"): null);
                
                displayLoginError(error.message || error.error || "An error occurred while signing up", (error.code === 4 || error.code === 5)? O("#regEmail"): (error.code === 3 || error.code === 6)? O("#regUsername"): error.code === 6? O("#regPassword"): null);
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
            O("#toolbarLogin").style.height = view.offsetHeight + "px";
        });
    });

    app.loginTabs.set(location.pathname.startsWith("/login") ? "login" : location.pathname.startsWith("/sign-up") ?  "register" : "default");

    O("#appsButton").on("click", function (){
        app.toolbarOpen("toolbarApps", true, this);
    })

    O("#themeButton").on("click", function (){
        app.toolbarOpen("toolbarTheme", true, this);
    })

    O("#randomPassword").on("click", function (){
        const password = generateSecurePassword(12);
        O("#regPassword").value = password;
        O("#regPassword").dispatchEvent(new Event("input"));
        alert("Your generated password: " + password);
    });

    O("#randomUsername").on("click", function (){
        const username = generateUsername();
        O("#regUsername").value = username.toLowerCase();
        O("#regUsername").dispatchEvent(new Event("input"));
        O("#displayname").value = username;
    });

    for(let accent of app.ACCENT_COLORS) {
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

    if(localStorage.hasOwnProperty("ls-accent")){
        const accent = localStorage.getItem("ls-accent");

        if(accent.startsWith("#")) {
            LS.Color.update('custom', accent);
            LS.Color.setAccent('custom');
        } else {
            LS.Color.setAccent(accent);
        }
    }

    O("#assistantButton").on("click", function (){
        app.toolbarOpen("toolbarAssistant", true, this);

        if(!window.__assistantLoading) {
            window._assistantCallback = null;
            window.__assistantLoading = true;

            setTimeout(async () => {
                M.LoadScript("/~/assets/js/assistant.js" + window.cacheKey, (error) => {
                    if(error || typeof window._assistantCallback !== "function") {
                        LS.Toast.show("Sorry, assistant failed to load. Please try again later.")
                        return;
                    }
    
                    window._assistantCallback(app, auth);
                })
            }, 0);
        }
    })

    app.viewport.on("click", () => {
        app.toolbarClose();
    })
})