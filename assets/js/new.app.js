const thisScript = document.currentScript;
window.cacheKey = "?mtime=" + thisScript.src.split("?mtime=")[1];

// TODO: Render an error page
if(!window.LS || typeof LS !== "object") throw new Error("Fatal error: Missing LS! Make sure it was loaded properly! Aborting.");

console.log(
    '%c LSTV %c\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#e74c3c, #e74c3c 33%, #f39c12 33%,#f39c12 66%,#3498db 66%,#3498db);border-radius:1em;color:white;font-weight:900;margin:1em 0',
    'font-size:1.5em;color:#ed6c30;font-weight:bold',
    'font-size:1em;font-weight:400'
);

(() => {
    class LoggerContext {
        constructor(context) {
            this.tag = `%c[${context}]%c`;
            this.tagStyle = 'font-weight: bold';
        }
    
        writeLog(func = console.log, tagStyle, message, ...data) {
            const isString = typeof message === 'string';
            if(!isString) data.unshift(message);
            func(this.tag + (isString ? " " + message : ''), tagStyle + this.tagStyle, 'color: inherit; font-weight: normal;', ...data);
        }
    
        log(...data) {
            this.writeLog(console.log, 'color: #3498db;', ...data);
        }
    
        error(...data) {
            this.writeLog(console.error, 'color: #e74c3c;', ...data);
        }
    
        warn(...data) {
            this.writeLog(console.warn, 'color: #f39c12;', ...data);
        }
    
        info(...data) {
            this.writeLog(console.info, 'color: #9b59b6;', ...data);
        }
    }
    
    class Page extends LS.EventHandler {
        constructor(options) {
            super();
            this.content = null;
    
            if(options) {
                if(options.url) this.fromURL(options.url);
                else if(options.element) this.fromElement(options.element);
                else if(options.text) this.fromText(options.text);
            }
        }
    
        async fromURL(url){
            const response = await fetch(url, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Akeno-Content-Only": "true"
                }
            });
    
            const text = await response.text();
            this.fromText(text);
            return this;
        }
    
        fromElement(element){
            this.content = element;
            return this;
        }
    
        fromText(text){
            this.content = N('div', {
                class: 'page-content',
                innerHTML: text
            });
            return this;
        }
    }
    
    const app = {
        isLocalhost: location.hostname.endsWith("localhost"),
    
        Page,
    
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
                const src = filename? filename.startsWith("blob:")? filename : app.cdn + '/file/' + filename + (!isAnimated? "?size=" + IMAGE_RESOLUTION: ""): "/assets/image/default.svg";
    
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
                    const src = filename.startsWith("blob:")? filename : app.cdn + '/file/' + filename;
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
                        const linkInfo = app.LINKS[link.type.toUpperCase()];
    
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
                    innerHTML: basicMarkDown(bio)
                })
            },
        },
    
        utils: {
            normalizePath(path, isAbsolute = null) {
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

        /**
         * Requests scoped access. This is required to access the website APIs.
         * @param {HTMLScriptElement|string} script - The script tag or unique identifier.
         * @param {Function} callback - The initialization callback function.
         */
        register(script, callback) {
            if(!window.__init) window.__init = [];
            window.__init.push({ script, callback });
        },

        /**
         * Requests permission for a specific feature or API subset.
         */
        requestPermission(permissionName, options) {
            // TODO:
        }
    }
    
    new class Kernel extends LoggerContext {
        version = '1.0.0';
    
        trustedScripts = new Set;
        events = new LS.EventHandler(app);
        SPAExtensions = [];
    
        pageCache = new Map;
    
        queryParams = LS.Util.params();
    
        CDN_URL = "https://cdn.extragon.cloud";
    
        auth = new class Auth extends LS.EventHandler {
            constructor() {
                super();
    
                this.iframeOrigin = `https://auth.extragon.${app.isLocalhost? "localhost": "cloud"}`;
                this.iframeURL = `${this.iframeOrigin}/bridge.html`;
    
                this.ready = false;
                this.iframe = null;
                this.callbacks = new Map();
    
                this.nonce = [...crypto.getRandomValues(new Uint32Array(4))].map(i => i.toString(36)).join("-");
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
                    this.iframe.contentWindow.postMessage({ type: 'init', nonce: this.nonce }, this.iframeOrigin);
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
    
            isLoggedIn(callback) {
                return this.postMessage('isLoggedIn', null, callback);
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
    
        constructor() {
            super('kernel');
    
            // Watch for device theme changes
            LS.Color.autoScheme();
    
            LS.Reactive.registerType("ProfilePicture", app.views.getProfilePictureView);
            LS.Reactive.registerType("ProfileBanner", app.views.getBannerView);
            LS.Reactive.registerType("ProfileLinks", app.views.getLinksView);
            LS.Reactive.registerType("ProfileBio", app.views.getBioView);
    
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
    
            document.addEventListener('DOMContentLoaded', () => {
                this.container = document.getElementById('app');
                this.viewport = document.getElementById('viewport');
    
                // Register initial page
                this.registerPage(location.pathname, { element: this.viewport.firstElementChild });
            });

            this.log('Kernel initialized, version %c' + this.version, 'font-weight: bold');
            if (window.__init) {
                for (const initEntry of window.__init) {
                    app.register(initEntry.script, initEntry.callback);
                }
            }
        }
    
        registerPage(path, options) {
            const page = new Page(options);
            this.pageCache.set(path, page);
            this.log(`Registered page for path %c${path}`, 'font-weight: bold');
            return page;
        }
    }
})();