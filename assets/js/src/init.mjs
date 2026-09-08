"use walker { walk $INPUT -v1.1 --no-exec --block-agents; _ifset PROD_BUILD else return 1; g-walker rebuild -I../glitter/compilers/ --toolset glitter-js-v8-specific --lang js -OM --format min -i $INPUT -o assets/js/kernel.js; ./merge.sh; }";

// WARNING: The following imports are just a stub, the actual build system is being worked on.
import { TmpFs, RootFs } from "./fs.mjs";
import { SoundBox } from "./soundbox.mjs";
import { LiDesktop, MediaPlayer } from "./desktop.mjs";
import { LoggerContext, AssetManager, ContentContext, Viewport, Thread } from "./commons.mjs";
import { app } from "./shared.mjs";
import { kernel } from "./kernel.mjs";

const KERNEL_VERSION = (typeof __buildVersion !== "undefined")? __buildVersion: "1.3.0-dev";

// TODO:
const BUILTIN_APPS = [
    {
        "name": "Townhall",
        "id": "townhall",
        "icon": "cd18c88051bcdc92.svg",
        "description": "A social community platform with servers, text & voice channels, threads, and more.",
        "version": "1.0.0",
        "link": "/chat"
    },
    {
        "name": "Video Editor",
        "id": "video-editor",
        "icon": "32c0975799f31fc3.svg",
        "description": "A full-featured, simple but professional video editor",
        "version": "1.0.0",
        "external": true,
        "link": "/editor"
    },
    {
        "name": "Resources",
        "id": "resource-monitor",
        "icon": "4cf4213e702a21fe.svg",
        "description": "Monitor loaded pages, applications, and other resources.",
        "version": "1.0.0",
        "main": "resourcemanager.mjs?1"
    },
    {
        "name": "Clock",
        "id": "clock",
        "icon": "d2973ce4286307f8.svg",
        "description": "What is the current time?",
        "version": "1.1.0",
        "main": "clock.mjs?0.1"
    },
    {
        "name": "Text Editor",
        "id": "text-editor",
        "icon": "ecf15bde6c275d83.svg",
        "description": "A simple Markdown text editor for your notes.",
        "version": "1.0.0",
        "main": "texteditor.mjs?0"
    },
    {
        "name": "Store",
        "id": "store",
        "icon": "8951e30e03967e75.svg",
        "description": "Get more apps and extensions!",
        "version": "1.0.0",
        "main": "store.mjs"
    },
    {
        "name": "Media Center",
        "id": "media-center",
        "icon": "5fe6243a90ae967a.webp",
        "description": "Your media hub.",
        "version": "1.0.0",
        "main": "media-center.mjs"
    },
    {
        "name": "Media Player",
        "id": "media-player",
        "icon": "5fe6243a90ae967a.webp",
        "description": "Play your media.",
        "version": "1.0.0",
        "main": "media-player.mjs"
    },
    {
        "name": "Music Player",
        "id": "music-player",
        "icon": "901fb7f3abda204f.svg",
        "description": "Play music, the pretty way!",
        "version": "1.0.0",
        "main": "music-player.mjs"
    },
    {
        "name": "File Manager",
        "id": "file-manager",
        "icon": "15043b26b7df5e3b.svg",
        "description": "Manage your files.",
        "version": "1.0.0",
        "main": "file-manager.mjs"
    },
    {
        "name": "Terminal",
        "id": "terminal",
        "icon": "c4972d221a92772b.svg",
        "description": "Use the command line & manage things",
        "version": "1.0.0",
        "main": "terminal.mjs"
    },
    {
        "name": "Calculator",
        "id": "calculator",
        "icon": "f0fb502ae0964022.svg",
        "description": "Perform various calculations.",
        "version": "1.0.0",
        "main": "calculator.mjs"
    },
    {
        "name": "WebView",
        "id": "webview",
        "icon": "62eb88beb684d561.svg",
        "description": "A simple embedded web browser.",
        "version": "1.0.0",
        "main": "webview.mjs"
    },
    {
        "name": "Email",
        "id": "mail-client",
        "icon": "901fb7f3abda204f.svg",
        "description": "Manage your emails.",
        "version": "1.0.0",
        "main": "mail.mjs"
    },
    {
        "name": "Mind Reader",
        "id": "mind-reader",
        "icon": "866c8c15f1ff50f1.svg",
        "description": "Reads your mind.",
        "version": "1.0.0",
        "main": "mind-reader.mjs"
    },
];
// localStorage.getItem("enableExperimentalApps") === "true" && {
//     "name": "monitors",
//     "id": "monitors",
//     "icon": "866c8c15f1ff50f1.svg",
//     "description": "",
//     "version": "1.0.0",
//     "main": "https://monitors.lstv.space",

//     windowOptions: {
//         width: 800,
//         height: 600
//     }
// }

// --- INITIALIZATION STUFF & DEFINITIONS (SKIP THIS PART)
// If the environment is correct, this file should be wrapped in an IIFE by the build system & not leak.

if(window.__kernelInitialized) {
    throw new Error("Kernel was already initialized - this is a bug!");
}

if(globalThis === this) {
    throw new Error("Kernel was loaded at the top level, this is a bug");
}

window.__kernelInitialized = true;

// Mtime mapped to kernel.js (This should never fallback)
window.cacheKey = "?mtime=" + (LS.Util.parseURLParams(document.currentScript?.src, "mtime") || Date.now());

if(!window.LS || typeof LS !== "object" || LS.v < 5) {
    window.__loadError('<h3 style="margin:40px 20px">The application framework failed to load. Please try again later.</h3>')
    throw new Error("Fatal error: Missing LS, or it's too old! Make sure it was loaded properly! Aborting.");
}

// Forward declarations
const scriptingLoadTime = Date.now();
const shortcutManager = new LS.ShortcutManager();
const isDebug = window.location.hostname === "lstv.localhost";
const isBeta = window.location.hostname.startsWith("beta.lstv.");

shortcutManager.map({
    "GLOBAL_OPEN_COMMAND_PALETTE": ['ctrl+shift+p', 'ctrl+k'],
    "GLOBAL_OPEN_MUSIC_PLAYER": ['ctrl+shift+alt+m', 'ctrl+alt+shift+m'],
    "GLOBAL_DESKTOP_OPEN_MENU": ['ctrl+space', 'ctrl+shift+m', 'ctrl+alt+m'],
    "GLOBAL_LOCK_SCREEN": ['ctrl+shift+l', 'ctrl+alt+l'],
    "GLOBAL_LOG_OUT": ['ctrl+shift+q', 'ctrl+alt+q'],
    "GLOBAL_OPEN_TERMINAL": ['ctrl+shift+t', 'ctrl+alt+t'],

    ...{} // todo: User data
});

// Console welcome message
if(!isDebug) console.log(
    '%c LSTV %c\nPlease beware:\n%cIF SOMEONE TOLD YOU TO PASTE SOMETHING HERE,\nTHEY MIGHT BE TRYING TO STEAL PERSONAL INFORMATION OR SCAM YOU.\nDO NOT USE THE CONSOLE IF YOU DON\'T KNOW\nWHAT YOU ARE DOING.\n\n',
    'font-size:4em;padding:10px;background:linear-gradient(to bottom,#e74c3c, #e74c3c 33%, #f39c12 33%,#f39c12 66%,#3498db 66%,#3498db);border-radius:1em;color:white;font-weight:900;margin:1em 0',
    'font-size:1.5em;color:#ed6c30;font-weight:bold',
    'font-size:1em;font-weight:400'
);

Document.prototype.write = Document.prototype.writeln = function() {
    throw new Error("Document.write is disabled for security and performance reasons. You should not use it.");
};

// --- MEMORY SAFETY ---
// We can use globals in the kernel code, anywhere else should throw an error.
// This is to help catch bad code before it causes leaks.
// Not needed in production, but can be useful during development, eg. if I forget to correctly isolate something.
// Why am I writing comments that nobody will read.

// LS.Context.debugEnforceContextSafety();
// LS.Context.debugWarnContextSafety();

const setTimeout = LS.Context.setTimeout;
const setInterval = LS.Context.setInterval;
const clearTimeout = LS.Context.clearTimeout;
const clearInterval = LS.Context.clearInterval;
const requestAnimationFrame = LS.Context.requestAnimationFrame;
const queueMicrotask = LS.Context.queueMicrotask;
const fetch = LS.Context.fetch;

function invokeAndReturn(f) { f(); return f }