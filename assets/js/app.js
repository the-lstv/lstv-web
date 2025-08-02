const thisScript = document.currentScript;
window.cacheKey = "?mtime=" + thisScript.src.split("?mtime=")[1];

console.log(
    '%c LSTV %c\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#e74c3c, #e74c3c 33%, #f39c12 33%,#f39c12 66%,#3498db 66%,#3498db);border-radius:1em;color:white;font-weight:900;margin:1em 0',
    'font-size:1.5em;color:#ed6c30;font-weight:bold',
    'font-size:1em;font-weight:400'
);

window.addEventListener("DOMContentLoaded", async () => {
    if(!window.LS || typeof LS !== "object") throw new Error("Fatal error: Missing LS! Make sure it was loaded properly! Aborting.");

    const isLocalhost = location.hostname.endsWith("localhost");
    const trustedScripts = new Set;

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
        container: O("#app"),
        viewport: O("#viewport"),

        pages: new Map(),

        currentPage: "",

        get page(){
            return app.pages.get(app.currentPage);
        },

        cdn: "https://cdn.extragon.cloud",

        originalQuery: LS.Util.params(),

        util: {
            normalizePath(path) {
                // Replace backslashes with forward slashes
                path = "/" + path.replace("index.html", "").replace(".html", "").replace(/\\/g, '/');

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

                const isAbsolute = path.startsWith('/');
                return (isAbsolute ? '/' : '') + normalizedPath;
            },

            generateIdentifier(){
                return crypto.getRandomValues(new Uint32Array(1))[0].toString(36) + Date.now().toString(36);
            }
        },

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

        async loadUser() {
            const isLoggedIn = await app.auth.isLoggedIn();

            app.isLoggedIn = isLoggedIn;
            O("#accountsButton").disabled = false;
            O("#accountsButton").ls_tooltip = isLoggedIn ? "Manage profiles": "Log in";

            if (isLoggedIn) {
                const user = await app.auth.getUserFragment();
                Object.assign(app.userFragment, user);
            } else {
                LS.Reactive.wrap("user", {});
            }

            app.emit("user-loaded", [app.userFragment]);
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

            for(let element of Q(".page")) element.style.display = "none";
            for(let element of Q(".page.active")) element.classList.remove("active");

            if (!options.browserTriggered) {
                history.pushState({ path }, document.title, path);
            }
            
            page.contentElement.style.display = "block";
            app.viewport.add(page.contentElement);

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

        getProfilePictureView(source, args) {
            const filename = (source && typeof source === "object")? source.pfp: source;

            const img = N("img", {
                src: filename? 'https://cdn.extragon.cloud/file/' + (typeof source === "object"? source.pfp: source): "/assets/image/default.svg",
                alt: "Profile Picture",
                class: "profile-picture",
                draggable: false,
                onerror() { this.src = "/assets/image/default.svg" }
            });

            if (args && args[0]) img.style.width = img.style.height = typeof args[0] === "number" ? args[0] + "px" : args[0];
            return img;
        },

        fetch(url, options = {}, callback) {
            return app.auth.fetch(url, options, callback);
        }
    }

    app.events = new LS.EventHandler(app);

    LS.Reactive.registerType("ProfilePicture", app.getProfilePictureView);

    const nonce = Math.random().toString(36).substring(2);

    app.auth = new class Auth extends LS.EventHandler {
        constructor() {
            super();

            this.iframeOrigin = `https://auth.extragon.${isLocalhost? "localhost": "cloud"}`;
            this.iframeURL = `${this.iframeOrigin}/bridge.html`;

            this.ready = false;
            this.iframe = null;
            this.callbacks = new Map();
        }
    
        #getFrame(callback) {
            if (this.ready) {
                if (callback) callback();
                return;
            }

            this.iframe = document.createElement('iframe');
            this.iframe.sandbox = "allow-scripts allow-same-origin";
            this.iframe.src = this.iframeURL;
            this.iframe.style.display = 'none';
            document.body.appendChild(this.iframe);

            window.addEventListener('message', e => {
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
    
            this.iframe.onload = () => {
                this.iframe.contentWindow.postMessage({ type: 'init', nonce }, this.iframeOrigin);
                this.ready = true;
                if (callback) callback();
            };
    
            this.iframe.onerror = error => {
                this.ready = false;
                if (callback) callback(error);
                console.error('Error loading iframe:', error);
            };
        }
    
        postMessage(action, data = {}, callback) {
            return new Promise((resolve, reject) => {
                const id = Math.random().toString(36).substring(2);
                this.callbacks.set(id, { callback, resolve, reject });
                this.#getFrame(() => {
                    this.iframe.contentWindow.postMessage({ action, id, ...data, nonce }, this.iframeOrigin);
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
            return postMessage('logout', null, callback);
        }

        getUserFragment(callback) {
            return this.postMessage('getUserFragment', null, callback);
        }

        isLoggedIn(callback) {
            return this.postMessage('isLoggedIn', null, callback);
        }

        getUserFragment(callback) {
            return this.postMessage('getUserFragment', null, callback);
        }

        patch(patch, callback) {
            return this.postMessage('patch', { patch }, callback);
        }
    }

    window.addEventListener('click', function (event) {
        const targetElement = event.target.closest("a");

        if (targetElement && targetElement.tagName === 'A') {
            
            if(targetElement.hasAttribute("target")) return;

            if(targetElement.href.endsWith("#")) return event.preventDefault();

            if(targetElement.href.startsWith(origin) && !targetElement.href.endsWith("?") && !targetElement.href.startsWith(origin + ":")){
                event.preventDefault();
                app.setPage(targetElement.getAttribute('href'));
                app.toolbarClose()
            }
        }
    });

    // Event listener for back/forward buttons (for single-page app behavior)
    window.addEventListener('popstate', function (event) {
        app.setPage(event.state? event.state.path: "/", { browserTriggered: true });
    });

    if(!isLocalhost){
        // Only give the global context limited access
        window.app = {
            module: app.module,

            loginTabs: app.loginTabs,

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

    LS.Color.on("theme-changed", () => {
        O("#themeButton i").className = "bi-" + (app.theme == "light"? "moon-stars-fill": "sun-fill");
    });

    // Load the initial page
    const page = new Page(location.pathname);
    app.currentPage = page.path;

    page.contentElement = O("#initial_page");

    if (window.__init) app.module(__initOrigin, __init);
    app.setPage(page, { browserTriggered: true });

    // Display content
    document.querySelector(".loaderContainer").style.display = "none";
    app.container.style.display = "flex";

    app.loadUser();

    app.auth.on("user-updated", (patch) => {
        if (patch) {
            Object.assign(app.userFragment, patch);
        }
    });

    O("#accountsButton").on("click", function (){
        app.loginTabs.set(app.isLoggedIn? "account": "default");
        app.toolbarOpen("toolbarLogin", true, this);
    });

    O("#logOutButton").on("click", function (){
        app.auth.logout(() => {
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
        location.replace(app.originalQuery.continue || (location.pathname.startsWith("/login") || location.pathname.startsWith("/sign-up"))? "/": location.href);
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

        app.auth.login(username, password, (error, result) => {
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

        app.auth.register({ email, username, password, displayname: displayName || null }, (error, result) => {
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
    
        LS.Animation.slideInToggle(view, oldElement);
        O("#toolbarLogin").style.height = view.clientHeight + "px";

        setTimeout(() => {
            O("#toolbarLogin").style.height = "auto";
        });
    });

    app.loginTabs.set(location.pathname.startsWith("/login") ? "login" : location.pathname.startsWith("/sign-up") ?  "register" : "default");

    O("#appsButton").on("click", function (){
        app.toolbarOpen("toolbarApps", true, this);
    })

    O("#themeButton").on("click", function (){
        app.toolbarOpen("toolbarTheme", true, this);
    })

    for(let accent of ["white","blue","pastel-indigo","lapis","pastel-teal","aquamarine","green","lime","neon","yellow","orange","deep-orange","red","rusty-red","pink","hotpink","purple","soap","burple"]) {
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
                        console.error(error || window._assistantCallback);
                        LS.Toast.show("Sorry, assistant failed to load. Please try again later.")
                        return;
                    }
    
                    window._assistantCallback(app);
                })
            }, 0);
        }
    })

    app.viewport.on("click", () => {
        app.toolbarClose();
    })
})