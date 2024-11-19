addEventListener("load", () => {
    const global = window;

    if(!global.LS){
        throw new Error("Application could not start! LS is missing!")
    }

    console.log('%c LSTV %c\nWelcome to the LSTV web!\n\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n', 'font-size:4em;padding:10px;background:linear-gradient(to bottom,#3498db, #3498db 33%, #f39c12 33%,#f39c12 66%,#e74c3c 66%,#e74c3c);border-radius:1em;color:white;font-weight:900;margin:1em;-webkit-text-stroke:2px #111','font-size:1.5em;font-weight:400','font-size:2em;font-weight:400;color:#ed6c30;font-weight:bold');

    let definedModules = [];

    let auth = null, __auth = null, __authRead = false, set = Akeno.randomSet;

    let app = {
        container: O("#app"),
        viewport: O("#viewport"),

        pages: new Map,

        get page(){
            return app.pages.get(app.currentPage) || null
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

            // User fragments (Contain information about users. Key = id. The values included vary based on availability - eg. when pocket information is fetched, it may get added to the user fragment, otherwise it is not there.)
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
                let pfp = source;

                if(typeof source === "number"){
                    pfp = app.user.fragments.get(source).pfp;
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

                setAuth(__auth.split(":").filter(token => !token.startsWith(app.user.current + "=")).join(":"))

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
                        authorization: __auth.split(":").find(token => token.startsWith(app.user.current + "=")).split("=")[1],
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
            
            O("#page_loading").style.display = "none";

            
            if(!result){
                O("#page_error").style.display = "flex";
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

        console.log(`[debug] App loaded in ${performance.now() - loadStarted}ms`);

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

    function _0x2494(){const _0x49bdaf=['body','329svUFeS','parsePayloadSignature','348366LvOzKT','getRandomValues','values','120WidodK','length','109974oZLdgi','12mluDNG','key','join','decode','removeItem','2655235EXRDOj',':app','211780cFeYFD','259330qQcCPY','3IBPWxB','91768myMSFp','from','includes','ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_','payloadSignature','floor','11304ahluwV','random','Session\x20token\x20may\x20only\x20be\x20read\x20once','225xeOtzF','keys','---','startsWith'];_0x2494=function(){return _0x49bdaf;};return _0x2494();}function _0x8bb2(_0x234cbf,_0x194fe1){const _0x2494b9=_0x2494();return _0x8bb2=function(_0x8bb21d,_0x129770){_0x8bb21d=_0x8bb21d-0x14d;let _0x279a8e=_0x2494b9[_0x8bb21d];return _0x279a8e;},_0x8bb2(_0x234cbf,_0x194fe1);}const _0x4e3b1d=_0x8bb2;(function(_0x1041fd,_0x3e9ddb){const _0x50cb84=_0x8bb2,_0x125516=_0x1041fd();while(!![]){try{const _0xdbbe7a=-parseInt(_0x50cb84(0x15a))/0x1+-parseInt(_0x50cb84(0x16c))/0x2+-parseInt(_0x50cb84(0x15b))/0x3*(parseInt(_0x50cb84(0x162))/0x4)+parseInt(_0x50cb84(0x14f))/0x5*(-parseInt(_0x50cb84(0x151))/0x6)+-parseInt(_0x50cb84(0x16a))/0x7*(-parseInt(_0x50cb84(0x15c))/0x8)+-parseInt(_0x50cb84(0x165))/0x9*(-parseInt(_0x50cb84(0x159))/0xa)+-parseInt(_0x50cb84(0x157))/0xb*(-parseInt(_0x50cb84(0x152))/0xc);if(_0xdbbe7a===_0x3e9ddb)break;else _0x125516['push'](_0x125516['shift']());}catch(_0x216d82){_0x125516['push'](_0x125516['shift']());}}}(_0x2494,0x69e49));_0x45a48b:{if(__authRead||__auth||auth)throw _0x4e3b1d(0x164);for(let key of Object['keys'](localStorage)){if(key[_0x4e3b1d(0x168)](':app')){try{if(localStorage[key][_0x4e3b1d(0x168)](_0x4e3b1d(0x167))){let payload=M[_0x4e3b1d(0x16b)](localStorage[key]),decoded=new TextDecoder()[_0x4e3b1d(0x155)](payload[_0x4e3b1d(0x169)][0x0]);decoded[_0x4e3b1d(0x15e)]('.')&&(auth=decoded);}}catch{}localStorage[_0x4e3b1d(0x156)](key);}}let objk=Object[_0x4e3b1d(0x166)];Object[_0x4e3b1d(0x166)]=_0x26efc3=>{if(_0x26efc3===localStorage)return[];return objk(_0x26efc3);};let objv=Object[_0x4e3b1d(0x14e)];Object[_0x4e3b1d(0x14e)]=_0x419337=>{if(_0x419337===localStorage)return[];return objv(_0x419337);},localStorage[_0x4e3b1d(0x153)]=()=>null;if(auth===null)auth='';setAuth(auth),__auth=auth;}function randomBase(){const _0xae13b1=_0x4e3b1d;return Math[_0xae13b1(0x161)](Math[_0xae13b1(0x163)]()*(0x24-0x10)+0x10);}function setAuth(_0x2930e0){const _0x2244f7=_0x4e3b1d;auth=_0x2930e0;for(let _0x4c011d of set){localStorage[_0x2244f7(0x158)+_0x4c011d]=M[_0x2244f7(0x160)](null,[Array[_0x2244f7(0x15d)]({'length':Math[_0x2244f7(0x161)](Math[_0x2244f7(0x163)]()*0x100)},()=>_0x2244f7(0x15f)['charAt'](Math[_0x2244f7(0x161)](Math[_0x2244f7(0x163)]()*0x40)))[_0x2244f7(0x154)]('')],0x10,randomBase());}if(_0x2930e0&&_0x2930e0[_0x2244f7(0x150)])localStorage[_0x2244f7(0x158)+set[crypto[_0x2244f7(0x14d)](new Uint8Array(0x1))[0x0]%0x3]]=M['payloadSignature'](null,[_0x2930e0],0x10,randomBase());}
    
    // getAuth: {
    //     if(__authRead || __auth || auth) throw "Session token may only be read once";

    //     for(let key of Object.keys(localStorage)){
    //         if(key.startsWith(":app")) {
    //             try{
    //                 if(localStorage[key].startsWith("---")){
    //                     let payload = M.parsePayloadSignature(localStorage[key])

    //                     let decoded = (new TextDecoder).decode(payload.body[0])

    //                     if(decoded.includes(".")){
    //                         auth = decoded
    //                     }
    //                 }
    //             } catch { }

    //             localStorage.removeItem(key)
    //         }
    //     }

    //     let objk = Object.keys;

    //     Object.keys = object => {
    //         if(object === localStorage) return [];
    //         return objk(object)
    //     }

    //     let objv = Object.values;

    //     Object.values = object => {
    //         if(object === localStorage) return [];
    //         return objv(object)
    //     }

    //     localStorage.key = () => null;

    //     if(auth === null) auth = "";

    //     setAuth(auth)

    //     __auth = auth;
    // }

    // function randomBase(){
    //     return Math.floor((Math.random() * (36 - 16)) + 16)
    // }

    // function setAuth(data){
    //     // This is more of a "security through obscurity" type thing.
    //     // Should be migrated immidiately as soon as a better method is available to browsers.

    //     auth = data;

    //     for(let thing of set){
    //         localStorage[":app" + thing] = M.payloadSignature(null, [Array.from({ length: Math.floor(Math.random() * 256) }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.charAt(Math.floor(Math.random() * 64))).join('')], 16, randomBase())
    //     }

    //     if(data && data.length) localStorage[":app" + set[crypto.getRandomValues(new Uint8Array(1))[0] % 3]] = M.payloadSignature(null, [data], 16, randomBase())
    // }

    // DEBUG
    app.module = global.app.module;
    global.app = app;

})