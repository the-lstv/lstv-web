class TerminalApp extends website.ContentContext {
    constructor() {
        super({
            title: "Terminal",
            id: "terminal",

            scripts: [
                LS.Create("script", {
                    src: "https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"
                }),
                LS.Create("script", {
                    src: "https://cdn.jsdelivr.net/npm/xterm-addon-webgl@0.16.0/lib/xterm-addon-webgl.min.js"
                })
            ],

            styles: [
                LS.Create("link", {
                    rel: "stylesheet",
                    href: "https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css"
                }),
            ]
        });

        this.content = LS.Create("div", {
            class: "terminal-container",
            style: {
                width: "100%",
                height: "100%",
                backgroundColor: "#000"
            }
        });

        this.fromElement(this.content);

        // Now let's create a window
        // The window will automatically show our content because we created it from here.
        // But since a window is an instance of viewport, we can also use it like any other viewport.
        const win = this.createWindow({
            title: "Hello World App",
            width: 400,
            height: 300
        });

        this.addDestroyable(win, this.content);

        this.once("loaded", () => {
            // Initialize the terminal
            this.initializeTerminal();
        });
    }

    initializeTerminal() {
        const container = this.content;

        this.terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "JetBrains Mono, monospace",
            theme: {
                background: "#000000",
                foreground: "#ffffff"
            }
        });

        // this.webglAddon = new WebglAddon.WebglAddon();
        // this.terminal.loadAddon(this.webglAddon);

        this.terminal.open(container);
        this.terminal.write('Hello from the terminal!\r\n');

        this.resizeObserver = new ResizeObserver(() => {
            this.fit();
        });

        this.resizeObserver.observe(container);
    }

    fit() {
        if(this.state !== "ready") return;
        const container = this.content;
        const { width, height } = container.getBoundingClientRect();

        // get the cell size from the terminal
        const term = this.terminal.element.querySelector(".xterm-screen");
        const cellWidth = term.offsetWidth / this.terminal.cols;
        const cellHeight = term.offsetHeight / this.terminal.rows;

        this.terminal.resize(Math.floor(width / cellWidth), Math.floor(height / cellHeight));
    }

    suspend() {}

    resume() {
        this.terminal.resize(this.terminal.cols, this.terminal.rows);
    }

    destroy() {
        this.resizeObserver.disconnect();

        this.terminal.dispose();
        this.terminal = null;

        if(this.webglAddon) {
            this.webglAddon.dispose();
            this.webglAddon = null;
        }

        this.content.remove();
        this.content = null;

        super.destroy();
    }
}

export default TerminalApp;