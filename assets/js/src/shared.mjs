// WARNING: The following imports are just a stub, the actual build system is being worked on.
import { TmpFs, RootFs } from "./fs.mjs";
import { SoundBox } from "./soundbox.mjs";
import { LiDesktop, MediaPlayer } from "./desktop.mjs";
import { LoggerContext, AssetManager, ContentContext, Viewport, Thread } from "./commons.mjs";
import { kernel } from "./kernel.mjs";
import { Enums } from "./enums.mjs";

// Misc constants
const DEFAULT_PROFILE = "/~/assets/image/default.svg";
const isDesktopModeEnabledAtStartup = localStorage.getItem("desktopMode") === "true";

const isNode = typeof module !== "undefined";

/**
 * Environment loader.
 * This class presents various OS functionalities (imagine it kind of like systemctl).
 * 
 * Provides the job of:
 * - fstab (reads & executes /etc/fstab on init())
 * - login (user credintals / authentication)
 * 
 * User management:
 * - useradd
 * - usermod
 * - userdel
 * - groupadd
 * - groupmod
 * - groupdel
 * Note that the above does not implement them as commands;
 * that's up to the distribution, which can use the same implementations.
 * 
 * Configuration:
 * - config management (login.defs, config.conf, ...)
 * - session management
 * - desktop loading
 */
class Environment {
    // Global environment variables
    env = {}

    // Temporary ref
    #k;

    setEnv(n, v) {
        this.env[n] = v;
    }

    async resolvePath(k, pathv = this.#k.env.PATH) {
        for(const s of pathv.split(":")) {
            const rd = await this.#k.fileSystem.readDir(s);
            for(const ent of rd) if(k === ent) return RootFs.join(s, ent);
        }
        return null;
    }

    constructor(k) {
        // if(!(k instanceof LinuxJsKernel)) throw new Error("Invalid instance of Kernel provided");
        if(!k.isKernel) throw new Error("Invalid instance of Kernel provided");

        this.#k = k;
        this.#k.once("destroy", () => {
            this.destroy();
        });

        // Export default env variables
        // this.setEnv("SHELL", "/bin/bash"); // based on user
        this.setEnv("HOSTNAME", k.sys.uname().nodename);
        this.setEnv("PATH", "/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin");
    }

    async init() {
        // Mount drives/filesystems in fstab
        await this.initFsTab();

        // // Read configuration files
        // const cfg    = await this.#k.fileSystem.readFile("/etc/config.conf", "utf8");

        // // Parse config
        // const parsed = AtriumParser.parse(cfg, { asLookupTable: true })
        // AtriumParser.configTools(parsed);

        // const groups  = await this.#k.fileSystem.readFile("/etc/group"       , "utf8");
        // const shells = await this.#k.fileSystem.readFile("/etc/shells"      , "utf8");
        // const hosts  = await this.#k.fileSystem.readFile("/etc/hosts"       , "utf8");

        // Initialize desktop
        app.desktop = new LiDesktop({ limited: !isDesktopModeEnabledAtStartup });
    }

    async getUsers(passwd = null) {
        if(typeof passwd !== "string") passwd = await this.#k.fileSystem.readFile("/etc/passwd", "utf8");

        return passwd.split("\n").filter(Boolean).map(v => {
            const [username, password, uid, gid, comment, home, shell] = v.split(":");
            return {
                username,
                password,
                uid,
                gid,
                comment,
                home,
                shell
            }
        });
    }

    async useradd(options) {
        const username = options.username;
        if(!username) {
            throw new Error("Invalid username");
        }
        
        const users = await this.getUsers();
        if(users.find(user => user.username === username)) {
            throw new Error("User with this username already exists");
        }

        // placeholder: todo: read from cfg
        const min = 1000;
        const max = 10000;

        // First free UID
        const uid = users
            .map(({ uid }) => uid)
            .filter(uid => uid >= min)
            .sort((a, b) => a - b)
            .reduce((candidate, uid) => uid === candidate ? candidate + 1 : candidate, min);

        if(uid >= max) {
            throw new Error("Max UID has been reached");
        }

        const home = RootFs.normalize(options.homeDir || `${options.baseDir || "/home"}/${username}`, true);

        // Create home directory
        // TODO: init user files & set uid/gid perms
        if(options.noCreateHome !== true) {
            await this.#k.fileSystem.mkdir(home);
        }

        // todo
        const gid = options.gid ?? uid;
        // if(options.noCreateGroup !== true) {
        //     await this.groupadd({ name: username, gid: uid });
        // }

        const passwd = [username, options.plainPassword || "x", uid, gid, options.comment, home, options.shell];

        // Write to passwd
        this.#k.fileSystem.appendFile("/etc/passwd", "\n" + passwd.join(":"));

        if(!options.plainPassword) {
            const hash = ""; // todo

            // user, hash, lastChange, minAge, maxAge, warningPeriod, inactivityPeriod, expiration
            const shadow = [username, hash, Math.floor(Date.now() / 86400000), 0, 0, 0, 0, 0];
    
            // Write to shadow
            this.#k.fileSystem.appendFile("/etc/passwd", "\n" + shadow.join(":"));
        }
    }

    /**
     * User auth. Use to authenticate an user.
     * Supports /etc/passwd & /etc/shadow
     * 
     * todo: password age warning
     * (implement lastChange, minAge, maxAge, warningPeriod, inactivityPeriod, expiration)
     * 
     * @see https://www.man7.org/linux/man-pages/man8/pam_unix.8.html
     * 
     * @param {string} username Username to authenticate
     * @param {*} credintals Credintals (password)
     * @returns {object|boolean} User object on success, false if wrong credintals
     * @throws {Error} Error while authenticating
     */
    async authenticate(username, credintals) {
        const users = await this.getUsers();
        const user = users.find(user => user.username === username);

        if(!user) throw new Error("User '" + username + "' not found");

        if(user.password === "x") {
            const shadowF = await this.#k.fileSystem.readFile("/etc/shadow", "utf8");
            let shadow = shadowF.split("\n").find(e => e.startsWith(username) + ":");

            if(!shadow) throw new Error("User '" + username + "' has no entry in /etc/shadow");
            
            shadow = shadow.split(":");
            let [_, hash, lastChange, minAge, maxAge, warningPeriod, inactivityPeriod, expiration] = shadow;
            if(!hash) throw new Error("User '" + username + "' has no hash entry in /etc/shadow");
            
            const alg = hash.slice(0, hash.indexOf("$", 1));
            if(!alg) throw new Error("User '" + username + "' has invalid hash entry in /etc/shadow");

            hash = hash.slice(alg.length);

            /**
             * Implementing all the hash algorithms is not very practical on the client-side.
             * We can use the Node.js builtins but still the exact support is not quite complete.
             * 
             * Currently, the browser version only implements SHA-512, if provided.
             * Yescrypt support is possible thanks to thynson/yescrypt-js and will eventually be implemented along other algorithms.
             * 
             * WARNING: The sha265 & sha512 implementation here is not currently complete/accurate to the Linux crypt() implementation.
             * It is sufficient for this kind of authentication & remote authentication is handled by a 3rd party provider which is why it is not the highest priority.
             */
            switch(alg) {
                // MD5
                case "$1$":
                    if(isNode) {
                        return require("crypto")
                        .createHash("md5")
                        .update(credintals)
                        .digest("hex") === hash? user: false;
                    }
                    throw new Error("clientside md5 support is planned");

                // bcrypt
                case "$2b$":
                    throw new Error("bcrypt support is planned");

                // SHA-256
                case "$5$":
                    if(isNode) {
                        return require("sha256")
                        .createHash("md5")
                        .update(credintals)
                        .digest("hex") === hash? user: false;
                    }
                    throw new Error("clientside SHA-256-crypt support is planned");

                // SHA-512
                case "$6$":
                    if(isNode) {
                        return require("sha512")
                        .createHash("md5")
                        .update(credintals)
                        .digest("hex") === hash? user: false;
                    }
                    return (window.sha512? sha512(credintals): null) === hash? user: false;

                // yescrypt
                case "$y$":
                    // https://github.com/thynson/yescrypt-js
                    throw new Error("Yescrypt support is planned");
                    break;
            }

            throw new Error("User '" + username + "' has a password stored in an unsupported hash type (" + alg + ")");
        }

        this.#k.warn("User " + username + " has plain-text password.")

        // Purposefully waste CPU cycles when using plain auth
        let burn = Date.now() + 2000;
        while(Date.now() < burn) {}

        return user.password === credintals;
    }

    async initFsTab(fstab = null) {
        if(typeof fstab !== "string") fstab = await this.#k.fileSystem.readFile("/etc/fstab", "utf8");

        for(let line of fstab.split("\n")) {
            line = line.trim();
            if(!line || line[0] === "#") continue;

            // Device <source> Path <mount-point> FsType <filesystem-type> Options <options> Whether to dump <dump> fsck order <fsck-order>
            let [source, mp, fst, options, dump, order] = line.split(" ").filter(Boolean).map(s => s.replaceAll("\\040", " "));

            if(options) options = options.split(",");

            if(!order) {
                this.#k.error("Can't mount fstab entry: entry '" + line + "' is invalid.");
                continue;
            }

            const fs = RootFs.fsTypes[fst];

            if(typeof fs !== "function") {
                this.#k.error("Can't mount fstab entry: filesystem '" + fst + "' is invalid.");
                
                if(options.indexOf("nofail") === -1) {
                    throw new Error;
                } else continue;
            }

            this.#k.fileSystem.mount(mp, new fs(source, options, dump, order));
        }
    }

    destroy() {
        this.#k = null;
    }
}

/**
 * <lstv.space>
 * Shared website object.
 * Specific utilities and constants related to the website as a whole.
 * 
 * !!! This is global and accessible by any 3rd party code, nothing sensitive or potentially vulnerable can be exposed.
 */
const app = {
    // Utils
    LoggerContext,
    ContentContext,
    Viewport,
    Thread,
    Window: LS.Window,

    // Create new instance of the desktop env.
    // If desktop mode is disabled, the desktop can skip some features, things like the login prompt, and run in a website-only mode.
    desktop: null,

    // Constants
    loaded: true,
    isEmbedded: window.self !== window.top,
    cdn: "https://cdn.extragon.cloud",
    api: "https://api.extragon." + (isDebug ? "localhost" : "cloud"),

    /**
     * List of available user badges.
     */
    BADGES: [
        { icon: "owner.png", label: "Owner", id: 0 },
        { icon: "developer.webp", label: "Developer at lstv.space", id: 1 },
        { icon: "supporter.webp", label: "Supporter", id: 2 },
        { icon: "early_supporter.png", label: "Early Supporter", id: 3 },
        { icon: "bug_hunter.png", label: "Bug Hunter", id: 4 },
        { icon: "community_helper.png", label: "Community Helper", id: 5 },
        { icon: "moderator.webp", label: "Moderator", id: 6 },
        { icon: "legacy.webp", label: "Legacy (2018-2024) account", id: -1 },
    ],

    /**
     * Reusable views
     */
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

            const isAnimated = filename && (user && user.__animated_pfp) || filename && filename.endsWith(".webm");
            const src = filename? filename.startsWith("blob:")? filename : app.cdn + '/file/' + filename + (!isAnimated? "?size=" + IMAGE_RESOLUTION: ""): DEFAULT_PROFILE;

            const img = LS.Create(isAnimated ? "video" : "img", {
                alt: "Profile Picture",
                class: "profile-picture",
                draggable: false,
                onerror() {
                    // despite everything, some browsers will still hapily burn your PC down
                    if(this.setDefault) return;

                    if (this.tagName.toLowerCase() === "video") {
                        const image = LS.Create("img", {
                            src: DEFAULT_PROFILE,
                            alt: "Profile Picture",
                            class: "profile-picture",
                            draggable: false,
                        });

                        this.src = "";
                        this.load();
                        this.replaceWith(image);
                        if (args && args[0]) image.style.width = image.style.height = typeof args[0] === "number" ? args[0] + "px" : args[0];
                        return;
                    }

                    if(this.src !== DEFAULT_PROFILE && this.src !== "" && !this.setDefault) {
                        // in case the default also fails, don't set again, otherwise the browser will go crazy (somehow dumb enough not to realize).
                        this.setDefault = true;
                        this.src = DEFAULT_PROFILE;
                    }
                },

                ...isAnimated && {
                    autoplay: false,
                    loop: true,
                    muted: true,
                    preload: "none"
                }
            });

            img.setAttribute("loading", "lazy");
            img.setAttribute("preload", "none");

            if(isAnimated) {
                img.setAttribute("data-src", src);
                // Memory leak: if image is removed, it the observer may still exist, but there's not a way to really fix that
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.load();
                            img.removeAttribute("data-src");
                        }
                        observer.disconnect();
                    }
                });
                observer.observe(img);
            } else {
                img.src = src;
            }

            const wrapper = LS.Create({
                class: "profile-picture-wrapper",
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

                const img = LS.Create(isAnimated? "video" : "img", {
                    alt: "Banner Picture",
                    class: "banner-media",
                    draggable: false,
                    onerror() { this.remove() },
                    attributes: {
                        alt: "Banner Image",
                        preload: "none"
                    },
                    ...isAnimated && {
                        autoplay: true,
                        loop: true,
                        muted: true
                    }
                });

                img.setAttribute("loading", "lazy");
                img.setAttribute("preload", "none");

                if(isAnimated) {
                    img.setAttribute("data-src", src);
                    const observer = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting) {
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.load();
                                img.removeAttribute("data-src");
                            }
                            observer.disconnect();
                        }
                    });
                    observer.observe(img);
                } else {
                    img.src = src;
                }

                return img;
            } else return null;
        },

        getProfileBadgesView(source, args, element, user) {
            const badges = source && (Array.isArray(source) ? source : Array.isArray(source.badges) ? source.badges : []);
            element.style.display = badges && badges.length ? "flex" : "none";
            if (!badges || !badges.length) return;

            if((user.legacy || +user.createdAt.slice(0, 4) <= 2024) && !badges.includes(-1)) {
                badges.push(-1); // Legacy badge
            }

            return LS.Create({
                class: "badges-container",
                inner: badges.map(badge => {
                    const badgeInfo = app.BADGES.find(b => b.id === badge);
                    if (!badgeInfo) return null;

                    return LS.Create({
                        class: "profile-badge",
                        tooltip: badgeInfo.label,
                        inner: LS.Create("img", {
                            src: "/~/assets/image/badges/" + badgeInfo.icon,
                            alt: badgeInfo.label
                        })
                    });
                })
            });
        },

        getLinksView(source, args, element) {
            const links = source && (Array.isArray(source) ? source : Array.isArray(source.profileLinks) ? source.profileLinks : []);
            element.style.display = links && links.length ? "block" : "none";

            if (!links || !links.length) return;

            return LS.Create({
                class: "links-container",
                inner: links.map(link => {
                    const linkInfo = app.LINKS[link.type.toUpperCase()];

                    return LS.Create("a", {
                        href: link.type === "url" ? link.link : linkInfo.scheme + link.link,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        class: "ls-button pill elevated",
                        accent: link.color || linkInfo.color || null,
                        inner: [
                            link.type === "url"? LS.Create("img", {
                                src: `https://favicone.com/${new URL(link.link).hostname}?s=32`
                            }): LS.Create("i", { class: "bi-" + (linkInfo?.icon || "globe-americas") }),
                            LS.Create("span", {
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

            return LS.Create({
                class: "profile-bio",
                innerHTML: app.utils.basicMarkDown(bio)
            })
        },

        getAppIconView(resource, args) {
            const iconParam = resource && resource.icon;
            const iconSrc = iconParam ? app.cdn + "/file/" + iconParam : null;

            const size = args && args[0] ? (typeof args[0] === "number" ? args[0] : parseInt(args[0], 10)) : 32;
            const padding = (size < 24) ? 0 : Math.max(4, (size - 24) / 6);
            const paddedSize = size - (padding * 2);

            const icon = LS.Create(iconSrc ? { tag: "img", attributes: { state: "loading" }, src: iconSrc, onerror() { this.parentElement.replaceChild(app.views.getAppIconView(null, args), this) }, onload() { this.removeAttribute('state'); } } : { tag: "i", class: "bi bi-app-indicator", style: "font-size: " + paddedSize + "px; line-height: 0" })
            icon.style.boxSizing = "border-box";
            icon.style.display = "inline-block";
            icon.style.objectFit = "contain";
            icon.style.verticalAlign = "middle";
            icon.style.position = "relative";
            icon.style.borderRadius = "var(--border-radius)";
            icon.style.padding = padding + "px";
            icon.style.width = size + "px";
            icon.style.height = size + "px";
            icon.draggable = false;

            return icon;
        }
    },

    /**
     * Utility functions
     */
    utils: {
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

        generateInsecurePassword() {
            return "password";
        }
    },

    ACCENT_COLORS: ["white", "blue", "pastel-indigo", "lapis", "pastel-teal", "aquamarine", "green", "lime", "neon", "yellow", "orange", "deep-orange", "red", "rusty-red", "pink", "hotpink", "purple"], //, "soap", "burple"],

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
    },

    get theme(){
        return document.body.getAttribute("ls-theme") || "dark";
    },

    // TODO: Multi-account support
    get userFragment() {
        return kernel.userFragment;
    },

    get DESKTOP_MODE() {
        return localStorage.getItem("desktopMode") === "true";
    },

    set DESKTOP_MODE(value) {
        value = !!value;
        localStorage.setItem("desktopMode", value? "true": "false");
        document.body.classList.toggle("lsweb-desktop-mode", value);

        if(app.desktop) {
            console.log(app.desktop);
            app.desktop.setDesktopMode(value);
        }
    },

    collapseItems: { schedule() {} },

    /**
     * NOTE: This is a cached result, and so may not be up to date. Wherever you can, use await kernel.auth.isLoggedIn(); instead - it's more expensive but accurate.
     */
    isLoggedIn: false,

    toolbarsContainer: document.getElementById("toolbars"),

    /**
     * Register a module/script scope. This scope can request permissions and access APIs.
     * @param {*} script Script tag or unique identifier of the context.
     * @param {LS.Context} runtimeContext Class extending or instance of LS.Context holding the module logic. This class must either: implement a .destroy() method that calls super.destroy(), or subscribe to context.on("destroy") and guarantee proper cleanup. The context will be passed as the first argument.
     */
    register(script, runtimeContext) {
        return kernel.registerModule(script, runtimeContext);
    },

    /**
     * Helper that calls back immediately when the user data is loaded, and subsequently whenever it changes.
     * Reliable method to ensure up-to-date user data at any point without race conditions.
     * TODO: Move to isolated contexts to avoid leaking the user fragment.
     * @param {Function} callback - The function to call with user data updates.
     * 
     * @warning Do NOT use this inside page contexts, use the handy wrapper context.watchUser().
     * Otherwise you this may get called on dead code.
     * 
     * @returns {void}
     */
    watchUser(callback) {
        // user-loaded is a completed event, meaning it will call immediately
        app.once("user-loaded", () => {
            callback(app.isLoggedIn, app.userFragment);
            app.on("user-changed", callback);
        });
    },

    loginTabs: new LS.Tabs("#toolbarLogin", {
        list: false,
        selector: ".login-toolbar-page",
        styled: false
    }),

    // Destroy shared state
    destroyState() {
        app.desktop.destroy();
    },

    /**
     * Check if the current environment has a specific capability.
     * This includes APIs, permissions, or features that may be available only in certain contexts.
     * @param {*} capability - The capability to check for.
     * @returns {boolean} - True if the capability is available, false otherwise.
     */
    hasCapability(capability) {
        // -- Desktop capabilities
        if(capability === "desktop") return !!app.desktop;
        if(capability === "system-sounds") return app.desktop && app.desktop.soundBox !== null;
        if(capability === "windows") return app.desktop && app.desktop.windowManager !== null;
        if(capability === "cloud-user") return location.protocol === "https:"; // todo
        if(capability === "command-palette") return app.desktop && app.desktop.commandPalette !== null; // todo
        if(capability === "notifications") return false; // todo

        // -- System capabilities
        if(capability === "filesystem") return true; // todo
        if(capability === "shell") return true; // todo

        // -- Web APIs
        if(capability === "clipboard") return !!navigator.clipboard;
        if(capability === "css-scroll-animations") return CSS.supports('animation-timeline: scroll()') && CSS.supports('animation-range: 0% 100%');
        if(capability === "gpu") return true; // todo
        if(capability === "midi") return navigator.requestMIDIAccess !== undefined;
        if(capability === "webaudio") return typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined";
        if(capability === "webgpu") return typeof navigator.gpu !== "undefined";
        if(capability === "webxr") return typeof navigator.xr !== "undefined";
        if(capability === "webassembly") return typeof WebAssembly !== "undefined";
        if(capability === "webgl") return typeof WebGLRenderingContext !== "undefined";
        if(capability === "webgl2") return typeof WebGL2RenderingContext !== "undefined";
        if(capability === "webvr") return typeof navigator.getVRDisplays !== "undefined";

        // -- Other
        if(capability === "native") return location.protocol !== "https:" && location.protocol !== "http:" && location.protocol !== "file:";
        if(capability === "vulkan") return false; // todo
        if(capability === "opengl") return false; // todo
        if(capability === "crystaline") return false; // todo
        if(capability === "glitter") return false; // todo
        if(capability === "ls-lisk") return false; // todo
        if(capability === "lsgio") return true; // todo
        if(capability === "http-proxy") return ""; // todo
        if(capability === "network-proxy") return ""; // todo
        return false;
    }
}

app.events = new LS.EventEmitter(app);
globalThis.website = app; // I just can't decide. I think I will keep app due to the app getting more integrated beyond a simple website.
globalThis.app = app;

export { Environment, app };