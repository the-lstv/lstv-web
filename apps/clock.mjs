class ClockApp extends website.ContentContext {
    constructor() {
        super({
            id: "clock",
            title: "Clock",
            icon: "9f893dbef3ac8de0.svg",
        });

        this.fromElement(LS.Create({
            class: "clock-app",
            inner: (this.timeElement = LS.Create({
                tag: "h1"
            }))
        }));

        this.window = this.createWindow({
            title: "Clock",
            width: 600,
            height: 400,
            minWidth: 350,
            minHeight: 130
        });

        this.setInterval(() => this.#render(), 1000);
        this.#render();
    }

    #render() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const seconds = now.getSeconds().toString().padStart(2, "0");
        this.timeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }

    destroy() {
        this.window.destroy();
        super.destroy();
    }
}

export default ClockApp;