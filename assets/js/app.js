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
})