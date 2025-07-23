


/*

    This script is a little old and may not be up to the best standards.
    If you see an obvious mistake, please inform me!

*/



const thisScript = document.currentScript;
window.cacheKey = "?mtime=" + thisScript.src.split("?mtime=")[1];

console.log(
    '%c LSTV %c\nWelcome to the LSTV web!\n\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#3498db, #3498db 33%, #f39c12 33%,#f39c12 66%,#e74c3c 66%,#e74c3c);border-radius:1em;color:white;font-weight:900;margin:1em;-webkit-text-stroke:2px #111','font-size:1em;font-weight:400','font-size:1.5em;font-weight:400;color:#ed6c30;font-weight:bold'
);

window.addEventListener("DOMContentLoaded", async () => {
    if(!window.LS || typeof LS !== "object") throw new Error("Fatal error: Missing LS! Make sure it was loaded properly! Aborting.");

    const trustedScripts = new Set;
    let __authString = localStorage.account || "";


    // TODO: Make something better again
    function setAuth(data){
        __authString = localStorage.account = data
    }

    function generateIdentifier(){
        return crypto.getRandomValues(new Uint32Array(1))[0].toString(36) + Date.now().toString(36)
    }


    class Page {
        constructor(path, options = {}){
            this.path = app.util.normalizePath(path)
            this.options = options

            app.pages.set(path, this)
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
            super(path, options)
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
                        inner: await response.text()
                    })

                    this.contentElement.pageObject = this

                    for(let script of this.contentElement.getAll("script")) {
                        if(script.parentElement !== this.contentElement) return;

                        const newScript = script.src
                            ? N("script", { src: script.src })
                            : N("script", { textContent: script.textContent });

                        const identifier = generateIdentifier();
                        newScript.setAttribute("data-identifier", identifier);

                        trustedScripts.add(identifier);
                        this.contentElement.add(newScript);

                        script.remove()
                    }

                    this.contentElement.getAll("script").forEach(script => {
                        if(script.parentElement !== this.contentElement) return;

                        // if(!app.pages.get(this.path).moduleName) app.pages.get(this.path).moduleName = app.pages.get(this.path).manifest.module || null;
                    })

                    this.contentElement.getAll('link[rel="stylesheet"]').forEach(link => {
                        if(link.parentElement !== this.contentElement) return;

                        this.contentElement.add(N("link", { href: link.href, rel: "stylesheet" }))
                        link.remove()
                    })

                } catch (error) {
                    console.error(error);
                    return false
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

        pages: new Map,

        get page(){
            return app.pages.get(app.currentPage)
        },

        currentPage: "",

        api: location.protocol + (location.hostname.endsWith("localhost")? "//api.extragon.localhost": "//api.extragon.cloud"),

        apiVersion: 2,

        cdn: "https://cdn.extragon.cloud",

        module() { throw new Error },

        originalQuery: LS.Util.params(),

        authStyle: "cookies",

        get cookieLogin(){
            return app.authStyle === "cookies"
        },

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
            }
        },

        user: {
            add(auth){
                if(typeof auth.id !== "number") return false;

                let users = __authString.split(":").filter(Boolean).filter(token => !(app.cookieLogin? token === String(auth.id): token.startsWith(auth.id + "=")))

                users.push(app.cookieLogin? auth.id: `${auth.id}=${auth.token}`)

                setAuth(users.join(":"))
                return true
            },

            list(){
                return __authString.split(":").map(login => {
                    const tokenIndex = login.indexOf("=");

                    let user_id = tokenIndex !== -1? login.slice(0, tokenIndex): login;

                    if(user_id && user_id.length > 0) return parseInt(user_id); else return null
                }).filter(garbage => garbage !== null)
            },

            use(id){
                let list = app.user.list();

                if(list.includes(+id)) {
                    app.user.current = +id
                    return true
                }

                return false
            },

            switch(id){
                if(app.user.use(id)){
                    localStorage.currentUser = id;
                
                    if(app.originalQuery.continue) return location.replace(app.originalQuery.continue);

                    location.reload()
                } else return false;
            },

            /*
                User fragments
                Contain information about users where user ID is the key.
                The data available vary on request (can be fetched during a session)
                
                Note that the fragment doesnt necesarry have to be the current
                active user - fragments collect all the information known about all fetched users.
            */

            fragments: new Map,

            get fragment(){
                return app.user.fragments.get(app.user.current)
            },

            async fetchAll(){
                let list = app.user.list();
                if(list.length < 1) return false;

                try {
                    users = await app.get(app.api + "/v2/auth/get/" + list.join()).json()
                } catch(e) {
                    console.error(e);
                    return false
                }

                if(Array.isArray(users) && users.length > 0) {
                    for(let fragment of users){
                        app.user.fragments.set(fragment.id, fragment);
                    }
                } else return false;

                return users
            },

            async fetch(){
                if(app.user.current === null) return false;

                let fragment;

                try {
                    fragment = await app.get(app.api + "/v2/auth/me").json();
                } catch(e) {
                    console.error(e);
                    return false
                }
                
                if(fragment && fragment.success) app.user.fragments.set(fragment.id, fragment);
                return fragment
            },

            getProfilePictureView(source = app.user.current, quality = 128){
                let pfp = typeof source === "number"? app.user.fragments.get(source).pfp: typeof source === "object"? source.pfp: source;

                return N({
                    class: "pfpWrap",
                    inner: pfp? N("img", {src: app.cdn + "/file/" + pfp + "?size=" + quality, class: "profilePicture", draggable: false, alt: "Profile picture"}): N("i", {class: "bi-person-fill profilePicture"})
                })
            },

            async logout(){
                if(typeof app.user.current !== "number") return;

                if(app.cookieLogin){
                    await app.get()
                }

                setAuth(__authString.split(":").filter(token => !token.startsWith(app.user.current + "=")).join(":"))

                app.user.current = null

                LS.invoke("before-logout")
                setTimeout(() => location.reload(), 8)
            },

            current: null
        },

        fetch(url, options = {}){
            const trustedOrigin = url.startsWith(app.api);

            if(trustedOrigin && app.authStyle === "cookies") options.credentials = 'include';

            return fetch(url, {
                ...options,
                headers: {
                    ...url.startsWith(app.api) && typeof app.user.current == "number" && (
                        app.authStyle === "token" ?
                            { "Authorization": __auth.split(":").find(token => token.startsWith(app.user.current + "=")).split("=")[1] }:
                            { "Data-Auth-Identifier": String(app.user.current) }
                    ),

                    ...options.headers
                }
            })
        },

        get(endpoint, options = {}){
            let response;

            // Backwards comp.
            if(arguments[2]){
                console.warn("Deprecated usage of app.get");
                options = arguments[2]
                options.body = arguments[1]
            }

            async function execute(){
                if(response) return response;

                return response = await app.fetch(endpoint.startsWith("http")? endpoint : `${app.api}/v${app.apiVersion}/${endpoint}`, {
                    ...options,
                    ...options.body && { method: "POST", body: typeof options.body == "string"? options.body : JSON.stringify(options.body) },
                });
            }

            return {
                get response(){
                    return response
                },

                execute,

                async json(){
                    let response;
                    try{
                        response = await (await execute()).json()
                    } catch (e) { console.error(e) }

                    return response
                },

                async text(){
                    let response;
                    try{
                        response = await (await execute()).text()
                    } catch (e) { console.error(e) }

                    return response
                },

                async blob(){
                    let response;
                    try{
                        response = await (await execute()).blob()
                    } catch (e) { console.error(e) }

                    return response
                },
            }
        },

        set theme(value){
            if(value !== null){
                LS.Color.setTheme(value)
            }

            O("#themeButton i").className = "bi-" + (app.theme == "light"? "moon-stars-fill": "sun-fill")
        },

        get theme(){
            return O().attr("ls-theme")
        },

        get isToolbarOpen(){
            return O("#toolbars").style.display !== "none"
        },

        toolbarOpen(id, toggle, button){
            if(app.headerWindowCurrent == id && app.isToolbarOpen) {
                if(toggle) app.toolbarClose()
                return
            }

            let view = O("#toolbars > #" + id);

            if(!view) return;

            Q("#toolbars > div").forEach(element => element.applyStyle({display: "none"}));
            O("#toolbars").style.display = "block"

            view.style.display = "block";

            LS.invoke("toolbar-open", id);

            app.headerWindowCurrent = id;

            Q("#headerButtons > button.open").forEach(element => element.class("open", false));
            button.class("open");
        },

        toolbarClose(){
            O("#toolbars").style.display = "none"
            LS.invoke("toolbar-close");

            Q("#headerButtons > button.open").forEach(element => element.class("open", false));
        },

        async setPage(path, options = {}){
            let page;

            if(path instanceof Page) { page = path; path = page.path } else
            if(typeof path === "string") page = app.pages.get(path);

            if(app.page.requiresReload && path !== app.page.path) {
                return location.href = path;
            }

            if(!page) {
                page = new RemotePage(path)
            }

            path = page.path;

            if(!options.browserTriggered && app.currentPage === path){
                return true
            }

            app.currentPage = page.path

            document.title = `LSTV | ${page.title || "Web"}`;
            
            app.viewport.getAll("style").forEach(style => style.disabled = true)
            
            for(let element of Q(".page")) element.style.display = "none";
            for(let element of Q(".page.active")) element.class("active", false);
            
            if (!options.browserTriggered) {
                history.pushState({ path }, document.title, path);
            }

            console.log("[app] Changed page to", path);

            const success = await page.contentRequested()

            if(!success) return false;
            
            page.contentElement.style.display = "block"
            app.viewport.add(page.contentElement)

            // O('.headerText').set(app.pages.get(path).manifest.header || "");
            // O('.headerTitle').style.fontWeight = app.pages.get(path).manifest.header? "600" : "400";
        },

        _about_to_redirect(){
            app.container.class("expired").set("<h1><i class=bi-hourglass-split></i></h1><br><h2>Redirecting...</h2>Please wait up to a few seconds while we redirect you to your target page.")

            app = window.app = null;

            return setTimeout(() => {
                app.container.add("<br><br>Did you get stuck here unexpectedly or nothing is happening?<br>Your browser might have reverted to this page on accident.<br>Try reloading the page to continue browsing!")
            }, 2500);
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
        // if(!event.state) return;

        app.setPage(event.state? event.state.path: "/", { browserTriggered: true });
    });


    function loadModule(init){
        // TODO: Get the actual page
        let page = app.pages.get(app.currentPage);
        init(app, page, page.contentElement);
    }


    // Debugging only!
    if(location.hostname.endsWith("localhost")){
        app.module = window.app.module;
        window.app = app;
    } else {
        window.app = {
            secure(script, init){
                const identifier = script.getAttribute("data-identifier");
    
                if(trustedScripts.has(identifier)){
                    loadModule(init)
                    trustedScripts.delete(identifier)
                }
            }
        };
    }


    LS.Color.on("theme-changed", () => {
        // This is correct, just poor coding skills
        app.theme = null
    })

    // Listen to preffered theme changes
    LS.Color.autoScheme();

    app.events = new LS.EventHandler(app);

    // Load the initial page
    const page = new Page(location.pathname)
    app.currentPage = page.path

    page.contentElement = O("#initial_page");

    if(window.__init) loadModule(__init)
    app.setPage(page, { browserTriggered: true })


    // Display content
    document.querySelector(".loaderContainer").style.display = "none"
    app.container.style.display = "flex"


    let userList = app.user.list();

    if(userList.length > 0){
        app.user.use(localStorage.hasOwnProperty("currentUser")? +localStorage.currentUser : userList[0])
        await app.user.fetch()
        app.events.completed("users-available");
    }

    let user = LS.Reactive.wrap("user", app.user.fragment || {});

    window.user = user;

    O("#profilePicturePreview").delAttr("load");
    O("#accountsButton").disabled = false;

    if(typeof app.user.current === "number") {

        // Yippe! Someone is logged in
        O("#accountsButton").attrAssign({"ls-accent": "auto"})
        O("#accountsButton").get(".text").set(user.displayname || user.username)
        O("#appsButton").style.display = "inline"

        O("#profileWrap").prepend(app.user.getProfilePictureView(user))
        
        O("#profileDisplayname").innerText = user.displayname || user.username;
        O("#profileUsername").innerText = "@" + user.username;

    }

    O("#themeButton").on("click", () => {
        app.theme = app.theme == "light"? "dark": "light";
    })

    O("#accountsButton").on("click", function (){
        app.toolbarOpen((user && typeof app.user.current === "number")? "toolbarAccount" : "toolbarLogin", true, this)
    })

    O("#assistantButton").on("click", function (){
        console.log("Assistant button clicked");
        
        if(!window.__assistantLoading) {
            window._assistantCallback = null;
            window.__assistantLoading = true;
            
            const container = O("#assistant");
            
            container.parentElement.removeAttribute("hidden");
            container.class("shown");

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

    O("#logOutButton").on("click", function (){
        app.user.logout()
    })

    O("#appsButton").on("click", function (){
        app.toolbarOpen("toolbarApps", true, this)
    })

    app.viewport.on("click", ()=>{
        app.toolbarClose();
    })
})