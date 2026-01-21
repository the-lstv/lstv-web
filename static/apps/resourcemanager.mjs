class ResourceMonitor extends website.ContentContext {
    #kernel = null;
    constructor() {
        super({
            id: "resource-monitor",
            title: "Resource Monitor",
            icon: "79fb1a87322b7fa0.svg",
        });

        this.#kernel = kernel;
        this.fromElement(LS.Create({
            tag: "div",
            class: "resource-monitor",
            inner: [
                { tag: "h2", text: "Resource Monitor" },
                { tag: "div", class: "resource-list" }
            ]
        }));

        this.window = this.createWindow({
            title: "Resource Monitor",
            width: 800,
            height: 600
        });

        // this.window.once("close", () => {
        //     this.destroy();
        // });

        this.updateList();
    }

    destroy() {
        this.window.destroy();
        super.destroy();
    }

    updateList() {
        const resources = this.listResources();
        const listContainer = this.content.querySelector(".resource-list");
        listContainer.innerHTML = "";

        for (const resource of resources) {
            const item = LS.Create({
                tag: "div",
                class: "resource-item",
                inner: [
                    { tag: "span", text: resource.visibleName },
                    { tag: "button", text: "Stop", onclick: () => {
                        resource.destroy();
                        this.updateList();
                    } }
                ]
            });
            listContainer.appendChild(item);
        }
    }

    listResources() {
        return this.#kernel.contexts.values();
    }
}

export default ResourceMonitor;