


addEventListener("load", () => {
    const global = window;

    if(!global.LS){
        throw new Error("Application could not start! LS is missing!")
    }

    console.log('%c LSTV %c\nWelcome to the LSTV web!\n\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n', 'font-size:4em;padding:10px;background:linear-gradient(to bottom,#3498db, #3498db 33%, #f39c12 33%,#f39c12 66%,#e74c3c 66%,#e74c3c);border-radius:1em;color:white;font-weight:900;margin:1em;-webkit-text-stroke:2px #111','font-size:1.5em;font-weight:400','font-size:2em;font-weight:400;color:#ed6c30;font-weight:bold');

    let definedModules = [];

    let __auth = null;

    let app = {
        container: O("#app"),
        viewport: O("#viewport"),

        pages: new Map,

        get page(){
            return app.pages.get(app.currentPage)
        },

        currentPage: "",

        api: location.hostname.endsWith("test")? "http://api.extragon.test": "https://api.extragon.cloud",

        apiVersion: 2,

        cdn: "https://cdn.extragon.cloud",

        module() { throw false },

        originalQuery: LS.Util.params(),

        util: {
            normalizePath(path) {
                // Replace backslashes with forward slashes
                path = path.replace(/\\/g, '/');

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
                if(typeof auth.id !== "number" || !auth.token) return false;

                let users = __auth.split(":").filter(garbage => garbage).filter(token => !token.startsWith(auth.id + "="))

                users.push(`${auth.id}=${auth.token}`)

                setAuth(users.join(":"))

                return true
            },

            list(){
                return __auth.split(":").map(token => {
                    let user = token.slice(0, token.indexOf("="));
                    if(user && user.length > 0) return +user;
                    return null
                }).filter(garbage => garbage !== null)
            },

            use(id){
                let list = app.user.list();

                if(list.includes(+id)) {
                    app.user.current = +id
                    app.user.fragment = null
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
                The data available vary on request (can be fetched later)
            */

            fragments: new Map,

            get fragment(){
                return app.user.fragments.get(app.user.current)
            },

            async fetchAll(){
                let list = app.user.list();
                if(list.length < 1) return false;

                try {
                    users = await(
                        await app.fetch(app.api + "/v2/auth/get/" + list.join())
                    ).json()
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

                let user;

                try {
                    user = await(
                        await app.fetch(app.api + "/v2/auth/me")
                    ).json();
                } catch(e) {
                    console.error(e);
                    return false
                }

                if(user.success) {
                    app.user.fragment = user
                }

                return user
            },

            getProfilePictureView(source = app.user.current, quality = 128){
                let pfp = typeof source === "number"? app.user.fragments.get(source).pfp: typeof source === "object"? source.pfp: source;

                return N({
                    class: "pfpWrap",
                    inner: pfp? N("img", {src: app.cdn + "/file/" + pfp + "?size=" + quality, class: "profilePicture", draggable: false, alt: "Profile picture"}): N("i", {class: "bi-person-fill profilePicture"})
                })
            },

            logout(){
                if(typeof app.user.current !== "number") return;

                setAuth(__auth.split(":").filter(token => !token.startsWith(app.user.current + "=")).join(":"))

                app.user.current = app.user.fragment = null

                LS.invoke("before-logout")
                setTimeout(() => location.reload(), 8)
            },

            current: null
        },

        fetch(url, options){
            return fetch(url, {
                ...options,
                ...url.startsWith(app.api) && typeof app.user.current == "number" ? {
                    headers: {
                        credentials: 'include',
                        authorization: __auth.split(":").find(token => token.startsWith(app.user.current + "=")).split("=")[1],
                        ...options.headers && options.headers
                    }
                }: {}
            })
        },

        get(endpoint, body, options){
            let response;

            async function execute(){
                if(response) return response;

                return response = await app.fetch(endpoint.startsWith("http")? endpoint : `${app.api}/v${app.apiVersion}/${endpoint}`, {
                    ...body && { method: "POST", body: typeof body == "string"? body : JSON.stringify(body) },
                    ...options
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

        post(endpoint, body, options){
            return app.get(endpoint, body, options)
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

            Q("#toolbars > div").all().applyStyle({display: "none"});
            O("#toolbars").style.display = "block"

            view.style.display = "block";

            LS.invoke("toolbar-open", id);

            app.headerWindowCurrent = id;

            Q("#headerButtons > button.open").all().class("open", 0);
            button.class("open");
        },

        toolbarClose(){
            O("#toolbars").style.display = "none"
            LS.invoke("toolbar-close");

            Q("#headerButtons > button.open").all().class("open", 0);
        },

        async navigate(path = "/", options = {}){
            if(!path || typeof path !== "string") return false;

            if(!options.refetch && !options.reload && app.currentPage == path){
                return true
            }

            path = app.util.normalizePath("/" + path.replace("index.html", "").replace(".html", ""));

            if(app.page && app.page.manifest.alias && app.page.manifest.alias.split(",").find(alias => path.endsWith(alias))){
                if (!options.browserTriggered) {
                    history.pushState({ path }, document.title, path);
                }
                return true
            }

            app.viewport.getAll("style").all(style => style.disabled = true)
            Q(".page").all().applyStyle({display: "none"});
            O("#loading_page").style.display = "block";

            let title = "LSTV | Error";

            let result = await (async () => {
                if(options.reload){
                    app.expireSession();

                    if(options.replace){
                        return location.replace(location.origin + path)
                    }

                    return location.href = path
                }

                let content = app.pages.get(path) ? app.pages.get(path).content : null;
    
                if(!content || options.refetch) {
                    let response;
    
                    try {
                        response = await fetch("/static" + path);
    
                        content = N("div", {
                            inner: await response.text(),
                            id: btoa(path).replaceAll("=", "-"),
                            class: "page"
                        })

                        app.pages.set(path, {
                            content,
                            manifest: content.has("ls-manifest")? content.get("ls-manifest").attr(): {},
                            path
                        })

                        content.getAll("script").all(script => {
                            if(script.parentElement !== content) return;

                            if(!app.pages.get(path).moduleName) app.pages.get(path).moduleName = app.pages.get(path).manifest.module || null;

                            content.add(N("script", script.innerText))
                            script.remove()
                        })
    
                    } catch (e) {
    
                        console.error(e);
                        return false
    
                    }
    
                    if(response.status > 399){
                        // TODO: An error page here
                        console.log(response.status);
                        return false
                    }
                }

                if(content.has("ls-manifest")) content.get("ls-manifest").remove();

                if(!O(`#${btoa(path).replaceAll("=", "-")}`)){
                    app.viewport.add(content)
                }

                if(app.pages.get(path).moduleName){
                    setTimeout(()=>{
                        if(!definedModules.includes(app.pages.get(path).moduleName)){
                            console.error(`[Secutity Violation] A page with the module name of "${app.pages.get(path).moduleName}" did not register a function within 20ms from its initial load - further attempts at registering a function have been blocked to eliminate security concerns.`)
                            definedModules.push(app.pages.get(path).moduleName)
                        }
                    }, 20)
                }

                content.getAll("style").all(style => style.disabled = false)

                title = "LSTV" + (app.pages.get(path).manifest.title? " | " + app.pages.get(path).manifest.title : "");
                O('.headerText').set(app.pages.get(path).manifest.header || "");
                O('.headerTitle').style.fontWeight = app.pages.get(path).manifest.header? "600" : "400";

                return true
            })();
            
            if(options.reload){
                return
            }
            
            O("#loading_page").style.display = "none";

            
            if(!result){
                O("#error_page").style.display = "flex";
            } else {
                Q(".page.active").all().class("active", false);

                let contentElement = (app.pages.get(path)? app.pages.get(path).content : null) || O(`#${btoa(path).replaceAll("=", "-")}`);

                contentElement.style.display = app.pages.get(path).manifest.display || "block";
                contentElement.class("active")
            }

            O(`title`).set(title)

            if (!options.browserTriggered) {
                history.pushState({ path }, title, path);
            }

            console.log("[app] Changed page to", path);
            app.currentPage = path;

            return result
        },
        
        async refresh(){
            await app.navigate(app.currentPage, {refetch: true})
        },

        expireSession(){
            app.container.class("expired").set("<h1><i class=bi-hourglass-split></i></h1><br><h2>Redirecting...</h2>Please wait up to a few seconds while we redirect you to your target page.")

            global.app = null;
            app = null;

            return setTimeout(() => {
                app.container.add("<br><br>Did you get stuck here unexpectedly or nothing is happening?<br>Your browser might have reverted to this page on accident.<br>Try reloading the page to continue browsing!<br><br><span style=color:gray>(This session has became invalid as something critical happened, eg. logged in/out.)</span>")
            }, 2000);
        }
    }

    // Enables single-page app behavior
    M.on('click', function (event) {
        const targetElement = event.target.closest("a");

        if (targetElement && targetElement.tagName === 'A') {
            
            if(targetElement.hasAttribute("target")) return;

            if(targetElement.href.endsWith("#")) return event.preventDefault();

            if(targetElement.href.startsWith(origin) && !targetElement.href.endsWith("?") && !targetElement.href.startsWith(origin + ":")){
                event.preventDefault();
                app.navigate(targetElement.getAttribute('href'));
                app.toolbarClose()
            }
        }
    });

    // Event listener for back/forward buttons (for single-page app behavior)
    window.addEventListener('popstate', function (event) {
        // if(!event.state) return;

        app.navigate(event.state? event.state.path: "/", {browserTriggered: true});
    });

    global.app = {
        module(name, init){
            let source = app.pages.values().find(page => page.moduleName == name);

            if(!source) {
                throw new Error(`[Security Violation] Module "${name}" has not been found on this page or does not have permission to access the global object`);
            }

            if(definedModules.includes(name)) {
                throw new Error(`[Security Violation] Module "${name}" already had a script registered`);
            }

            definedModules.push(name)

            init(app, source, source.content)
        }
    };

    __auth = localStorage.token || "";

    function setAuth(data){
        // TODO: Make something better again
        localStorage.token = data
    }

    LS.once("body-available", async () => {
        LS.Color.on("theme-changed", () => {
            app.theme = null
        })
    
        // Set the theme based on user preffered scheme and add an listener to when this changes to apply automatically:
        LS.Color.adaptiveTheme()
        LS.Color.on("scheme-changed", LS.Color.adaptiveTheme)

        app.events = new(LS.EventResolver())(app);

        app.navigate(location.pathname, {browserTriggered: true})

        app.container.style.display = "flex"

        let userList = app.user.list();

        if(userList.length > 0){
            app.user.use(localStorage.hasOwnProperty("currentUser")? +localStorage.currentUser : userList[0])
            await app.user.fetchAll()

            app.invoke("users-available");

            app.events.prepare({
                name: "users-available",
                completed: true
            })
        }

        let user = app.user.fragment;

        O("#profilePicturePreview").delAttr("load");

        if(!user || typeof app.user.current !== "number") {

            // No user is logged in
            O("#accountsButton").attrAssign({"ls-accent": "auto"})
            O("#accountsButton").get(".text").set("Log-In")


        } else {

            // Yippe! Someone is logged in
            O("#accountsButton").attrAssign({"ls-accent": "auto"})
            O("#accountsButton").get(".text").set(user.displayname || user.username)
            O("#appsButton").style.display = "inline"

            O("#profileWrap").prepend(app.user.getProfilePictureView(user))
            
            O("#profileDisplayname").innerText = user.displayname || user.username;
            O("#profileUsername").innerText = "@" + user.username;

        }

        O("#themeButton").on("click", ()=>{
            app.theme = app.theme == "light"? "dark": "light";
        })

        O("#accountsButton").on("click", function (){
            app.toolbarOpen((user && typeof app.user.current === "number")? "toolbarAccount" : "toolbarLogin", true, this)
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

    if(location.hostname.endsWith("test")){
        app.module = global.app.module;
        global.app = app;
    }
})