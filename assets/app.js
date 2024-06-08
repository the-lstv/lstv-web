((global) => {

    if(!global.LS){
        throw new Error("Application could not start! LS is missing!")
    }

    console.log('%c LSTV %c\nWelcome to the LSTV web!\n\nPlease beware: %cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE, THEY MIGHT BE TRYING TO SCAM YOU.\nONLY USE THE CONSOLE IF YOU KNOW EXACTLY WHAT YOU ARE DOING.\n\n', 'font-size:4em;padding:10px;background:linear-gradient(to bottom,#3498db,#f39c12,#e74c3c);border-radius:1em;color:white;font-weight:900;margin:1em','font-size:2em;font-weight:400;margin:0 2.5em','font-size:2em;font-weight:400;margin:0 2.5em;color:red;font-weight:bold');

    let definedModules = [];

    let auth = null, set = $_backend.randomSet;

    let app = {
        container: O("#app"),
        viewport: O("#viewport"),

        pages: {},

        get page(){
            return app.pages[app.currentPage] || null
        },

        currentPage: "",

        api: true? "https://api.extragon.cloud": "http://api.extragon.test",

        apiVersion: 2,

        cdn: "https://cdn.extragon.cloud",

        module(){

        },

        originalQuery: LS.Util.params(),

        util: {
            normalizePath(path) {
                // Replace backslashes with forward slashes
                path = path.replace(/\\/g, '/');
            
                // Resolve '..' and '.' in the path
                const parts = path.split('/');
                const normalizedParts = [];
            
                for (const part of parts) {
                    if (part === '..') {
                        // Pop the last directory off the stack if '..' encountered
                        normalizedParts.pop();
                    } else if (part !== '.' && part !== '') {
                        // Ignore '.' and empty parts
                        normalizedParts.push(part);
                    }
                }
            
                // Join the parts to form the normalized path
                const normalizedPath = normalizedParts.join('/');
            
                // Check if the path was absolute and preserve the leading slash
                const isAbsolute = path.startsWith('/');
                return (isAbsolute ? '/' : '') + normalizedPath;
            }
        },

        user: {
            add(auth){
                console.log(auth);
                if(typeof auth.id !== "number" || !auth.token) return false;

                let users = getAuth().split(":").filter(garbage => garbage).filter(token => !token.startsWith(auth.id + "="))

                users.push(`${auth.id}=${auth.token}`)

                setAuth(users.join(":"))

                return true
            },

            list(){
                return getAuth().split(":").map(token => {
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

            // User fragments (Contain information about users. Key = id. The values may vary based on availability - eg. when pocket information is fetched, it may get added.)
            fragments: {},

            get fragment(){
                return app.user.fragments[app.user.current]
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
                        app.user.fragments[fragment.id] = fragment;
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
                let pfp = source;

                if(typeof source === "number"){
                    pfp = app.user.fragments[source].pfp;
                } else if(typeof source === "object"){
                    pfp = source.pfp
                }

                let wrapper = N({
                    class: "pfpWrap"
                })

                if(pfp) {
                    wrapper.add(N("img", {src: app.cdn + "/file/" + pfp + "?size=" + quality, class: "profilePicture", draggable: false, alt: "Profile picture"}))
                } else {
                    wrapper.add(N("i", {class: "bi-person-fill profilePicture"}))
                }

                return wrapper
            },

            logout(){
                if(typeof app.user.current !== "number") return;

                setAuth(getAuth().split(":").filter(token => !token.startsWith(app.user.current + "=")).join(":"))

                app.user.current = null
                app.user.fragment = null

                LS.invoke("before-logout")

                setTimeout(() => location.reload(), 2)
            },

            current: null
        },

        fetch(url, options = {}){
            return fetch(url, {
                ...options,
                ...url.startsWith(app.api) && typeof app.user.current == "number" ? {
                    headers: {
                        authorization: getAuth().split(":").find(token => token.startsWith(app.user.current + "=")).split("=")[1],
                        ...options.headers? options.headers : {}
                    }
                }: {}
            })
        },

        get(endpoint, body, options){
            let response;

            async function execute(){
                if(response) return response;

                response = await app.fetch(endpoint.startsWith("https://")? endpoint : `${app.api}/v${app.apiVersion}/${endpoint}`, {
                    ...body? {body: typeof body == "string"? body : JSON.stringify(body)} : {},
                    ...body? {method: "POST"} : {},
                    ...options
                });

                return response
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

        post(endpoint, body, options = {}){
            return app.get(endpoint, body, {
                method: "POST",
                ...options
            })
        },

        set theme(value){

            // Do NOT remove this check - in the case that we set "null", only the button should be updated, so this is correct.
            // The theme cant become "null". Default value is dark.
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
            O("#page_loading").style.display = "block";

            let title = "LSTV | Error";

            let result = await (async () => {
                if(options.reload){
                    app.expiredSession = true;

                    if(options.replace){
                        return location.replace(location.origin + path)
                    }

                    return location.href = path
                }

                let content = app.pages[path] ? app.pages[path].content : null;
    
                if(!content || options.refetch) {
                    let response;
    
                    try {
                        response = await fetch("/static" + path);
    
                        content = N("div", {
                            inner: await response.text(),
                            id: btoa(path).replaceAll("=", "-"),
                            class: "page"
                        })

                        app.pages[path] = {
                            content,
                            manifest: content.has("ls-manifest")? content.get("ls-manifest").attr(): {},
                            path
                        }

                        content.getAll("script").all(script => {
                            if(script.parentElement !== content) return;

                            if(!app.pages[path].moduleName) app.pages[path].moduleName = app.pages[path].manifest.module || null;

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

                if(app.pages[path].moduleName){
                    setTimeout(()=>{
                        if(!definedModules.includes(app.pages[path].moduleName)){
                            console.error(`[Secutity Violation] A page with the module name of "${app.pages[path].moduleName}" did not register a function within 20ms from its initial load - further attempts at registering a function have been blocked to eliminate security concerns.`)
                            definedModules.push(app.pages[path].moduleName)
                        }
                    }, 20)
                }

                content.getAll("style").all(style => style.disabled = false)

                title = "LSTV" + (app.pages[path].manifest.title? " | " + app.pages[path].manifest.title : "");
                O('.headerText').set(app.pages[path].manifest.header || "");
                O('.headerTitle').style.fontWeight = app.pages[path].manifest.header? "600" : "400";

                return true
            })();
            
            if(options.reload){
                return
            }
            
            O("#page_loading").style.display = "none";

            
            if(!result){
                O("#page_error").style.display = "flex";
            } else {
                let contentElement = (app.pages[path]? app.pages[path].content : null) || O(`#${btoa(path).replaceAll("=", "-")}`);

                contentElement.style.display = app.pages[path].manifest.display || "block";
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

        set expiredSession(value){
            if(value){
                O("#app").class("expired").set("<h1><i class=bi-hourglass-split></i></h1><br><h2>Redirecting...</h2>Please wait up to a few seconds while we redirect you to your target page.")
                
                global.app = null;
                app = null;

                setTimeout(() => {
                    O("#app").add("<br><br>Did you get stuck here unexpectedly and nothing is happening?<br>Your browser might have reverted to this page on accident.<br>Try reloading the page to continue browsing!<br><br><span style=color:gray>(This session became invalid as you changed something critical, eg. logged in/out.)</span>")
                }, 2000);
            }
        }
    }

    LS.once("app-ready", async ()=>{

        app.events = new(LS.EventResolver())(app);

        app.navigate(location.pathname, {browserTriggered: true})

        app.container.style.display = "flex"
        O(loading).hide()

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

    // Enables single-page app behavior
    M.on('click', function (event) {
        const targetElement = event.target.closest("a");

        if (targetElement && targetElement.tagName === 'A') {
            
            if(targetElement.hasAttribute("target")) return;

            if(targetElement.href.endsWith("#")) return event.preventDefault();

            if(targetElement.href.startsWith(origin) && !targetElement.href.endsWith("?")){
                event.preventDefault();
                app.navigate(targetElement.getAttribute('href'));
                app.toolbarClose()
            }
        }
    });

    // Event listener for back/forward buttons (for single-page app behavior)
    window.addEventListener('popstate', function (event) {
        if(!event.state) return;

        app.navigate(event.state.path, {browserTriggered: true});
    });

    global.app = {
        module(name, init){
            let source = Object.values(app.pages).find(page => page.moduleName == name);

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

    (function(_0x528858,_0x3f8835){const _0x7fcecd=_0x59a4,_0x4f287e=_0x528858();while(!![]){try{const _0x37399f=-parseInt(_0x7fcecd(0x1c9))/0x1+-parseInt(_0x7fcecd(0x1c8))/0x2+-parseInt(_0x7fcecd(0x1da))/0x3+parseInt(_0x7fcecd(0x1c6))/0x4*(parseInt(_0x7fcecd(0x1d6))/0x5)+-parseInt(_0x7fcecd(0x1ce))/0x6*(parseInt(_0x7fcecd(0x1d1))/0x7)+-parseInt(_0x7fcecd(0x1d5))/0x8*(parseInt(_0x7fcecd(0x1c7))/0x9)+parseInt(_0x7fcecd(0x1cc))/0xa*(parseInt(_0x7fcecd(0x1d4))/0xb);if(_0x37399f===_0x3f8835)break;else _0x4f287e['push'](_0x4f287e['shift']());}catch(_0x352563){_0x4f287e['push'](_0x4f287e['shift']());}}}(_0x2a1e,0x65c75));function getAuth(){const _0x3194cf=_0x59a4;if(auth!==null)return auth;for(let _0x18f25c of Object[_0x3194cf(0x1cb)](localStorage)){if(_0x18f25c['startsWith'](_0x3194cf(0x1d7))){try{let _0x45f9aa=atob(localStorage[_0x18f25c]['substring'](0x0,0x14));/[0-9]/['test'](_0x45f9aa[0x0])&&_0x45f9aa[_0x3194cf(0x1cf)]('=')&&(auth=atob(localStorage[_0x18f25c]));}catch{}localStorage['removeItem'](_0x18f25c);}}let _0x31df8a=Object['keys'];Object[_0x3194cf(0x1cb)]=_0x10482c=>{if(_0x10482c===localStorage)return[];return _0x31df8a(_0x10482c);};let _0xa41b1e=Object[_0x3194cf(0x1d0)];Object[_0x3194cf(0x1d0)]=_0x41534c=>{if(_0x41534c===localStorage)return[];return _0xa41b1e(_0x41534c);};if(auth===null)auth='';return setAuth(auth),auth;}function _0x59a4(_0x471624,_0x339255){const _0x2a1e82=_0x2a1e();return _0x59a4=function(_0x59a43c,_0x2b3c25){_0x59a43c=_0x59a43c-0x1c6;let _0x3eaa17=_0x2a1e82[_0x59a43c];return _0x3eaa17;},_0x59a4(_0x471624,_0x339255);}function setAuth(_0x30533f){const _0x4e6d48=_0x59a4;auth=_0x30533f;for(let _0x8494a6 of set){localStorage[':app'+_0x8494a6]=btoa(Array['from']({'length':Math[_0x4e6d48(0x1d9)](Math[_0x4e6d48(0x1d2)]()*0x100)},()=>_0x4e6d48(0x1ca)[_0x4e6d48(0x1d8)](Math[_0x4e6d48(0x1d9)](Math[_0x4e6d48(0x1d2)]()*0x40)))[_0x4e6d48(0x1cd)](''));}localStorage[_0x4e6d48(0x1d7)+set[crypto[_0x4e6d48(0x1d3)](new Uint8Array(0x1))[0x0]%0x3]]=btoa(auth);}function _0x2a1e(){const _0x2ce9f5=[':app','charAt','floor','305763THArkd','60GwTGFs','1914309TRqYcU','1529342aGpAKd','787754SuaZBP','ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_','keys','27172330WRQRMa','join','4129176sFvoSO','includes','values','7jlHfYK','random','getRandomValues','11HvmeVw','8hZGUcQ','84965BNWkSM'];_0x2a1e=function(){return _0x2ce9f5;};return _0x2a1e();}
    
    /*
    function getAuth(){
        if(auth !== null) return auth;

        for(let key of Object.keys(localStorage)){
            if(key.startsWith(":app")) {
                try{
                    let check = atob(localStorage[key].substring(0, 20));
                    if(/[0-9]/.test(check[0]) && check.includes("=")){
                        auth = atob(localStorage[key]);
                    }
                } catch {}

                localStorage.removeItem(key)
            }
        }

        let objk = Object.keys;

        Object.keys = object => {
            if(object === localStorage) return [];
            return objk(object)
        }

        let objv = Object.values;

        Object.values = object => {
            if(object === localStorage) return [];
            return objv(object)
        }

        localStorage.key = () => null;

        if(auth === null) auth = "";

        setAuth(auth)

        return auth;
    }

    getAuth();

    function setAuth(data){

        // This is more of a "security through obscurity" type thing.
        // Should be migrated immidiately as soon as a better method is available to browsers.

        auth = data;

        for(let thing of set){
            localStorage[":app" + thing] = btoa(Array.from({ length: Math.floor(Math.random() * 256) }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.charAt(Math.floor(Math.random() * 64))).join(''));
        }

        localStorage[":app" + set[crypto.getRandomValues(new Uint8Array(1))[0] % 3]] = btoa(auth)
    }
    */

    // DEBUG
    app.module = global.app.module;
    global.app = app;

})(window)