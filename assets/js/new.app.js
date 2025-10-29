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

const app = new class App {
    
}

new class Kernel extends LoggerContext {
    version = '1.0.0';

    isLocalHost = location.hostname.endsWith("localhost");
    trustedScripts = new Set;
    events = new LS.EventHandler(app);
    SPAExtensions = [];

    pageCache = new Map;

    queryParams = LS.Util.params();

    CDN_URL = "https://cdn.extragon.cloud";

    constructor() {
        super('kernel');

        // Watch for device theme changes
        LS.Color.autoScheme();

        LS.Reactive.registerType("ProfilePicture", app.getProfilePictureView);
        LS.Reactive.registerType("ProfileBanner", app.getBannerView);
        LS.Reactive.registerType("ProfileLinks", app.getLinksView);
        LS.Reactive.registerType("ProfileBio", app.getBioView);

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
    }

    registerPage(path, options) {
        const page = new Page(options);
        this.pageCache.set(path, page);
        this.log(`Registered page for path %c${path}`, 'font-weight: bold');
        return page;
    }
}

function basicMarkDown(text) {
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
}