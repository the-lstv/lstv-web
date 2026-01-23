class ResourceMonitor extends website.ContentContext {
    #kernel = null;
    #selectedContextId = null;
    #rowCache = new Map();

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
                { tag: "div", class: "resource-list", style: "flex-grow: 1; overflow-y: auto;", inner: {
                    tag: "table",
                    class: "clear",
                    inner: [
                        {
                            tag: "thead", inner: [
                                {
                                    tag: "tr", inner: [
                                        { tag: "th", text: "Name" },
                                        { tag: "th", text: "Type" },
                                        { tag: "th", text: "Status" }
                                    ]
                                }
                            ]
                        },
                        (this.tbody = LS.Create({ tag: "tbody" }))
                    ]
                } },
                {
                    tag: "div", inner: [
                        [
                            { tag: "button", text: "Refresh", onclick: () => this.frameScheduler.schedule() },
                            { tag: "button", inner: [{ tag: "i", class: "bi-trash-fill" }, "Clear all suspended"], class: "elevated", onclick: () => this.#kernel.clearAllOtherPages() },
                        ],

                        [
                            { tag: "button", class: "elevated", inner: [{ tag: "i", class: "bi-stop-fill" }, "Stop"], accent: "red", onclick: () => this.action('stop') }
                        ]
                    ]
                }
            ]
        }));

        // Only update the list at most once per frame; should not be an issue, but just in case, + resource manager should be responsive
        this.frameScheduler = this.addDestroyable(new LS.Util.FrameScheduler(() => this.updateList()));
        this.frameScheduler.limitFPS(15);

        // Listen to kernel events
        this.addExternalEventListener(this.#kernel, "context-created", () => this.frameScheduler.schedule());
        this.addExternalEventListener(this.#kernel, "context-updated", () => this.frameScheduler.schedule());
        this.addExternalEventListener(this.#kernel, "context-destroyed", () => this.frameScheduler.schedule());

        this.window = this.createWindow({
            title: "Resource Monitor",
            width: 650,
            height: 340,
            minWidth: 450,
        });

        this.updateList();
    }

    action(type) {
        if (!this.#selectedContextId) return;
        const context = [...this.#kernel.contexts.values()].find(c => c.id === this.#selectedContextId);
        if (!context) return;

        if(type !== 'stop' && context instanceof ResourceMonitor) {
            LS.Toast.show("Cannot suspend or resume the Resource Monitor itself.", { accent: "red" });
            return;
        }

        switch (type) {
            case 'suspend':
                if (context.suspend) context.suspend();
                break;
            case 'resume':
                if (context.resume) context.resume();
                break;
            case 'stop':
                context.destroy();
                break;
        }

        if(this.destroyed) return; // If we destroyed ourselves
        this.frameScheduler.schedule();
    }

    updateList() {
        // Ensure we don't keep any references to the context itself, just collect and display its information
        const resources = this.listResources();
        const activeIds = new Set();

        for (const resource of resources) {
            activeIds.add(resource.id);
            let row = this.#rowCache.get(resource.id);
            const isSelected = resource.id === this.#selectedContextId;
            const iconParam = resource.icon;
            const nameParam = resource.visibleName || resource.id;
            const type = resource.constructor.name === "ContentContext" && resource.path ? "Page" : resource.constructor.name;

            if (!row) {
                row = LS.Create({
                    tag: "tr",
                    onclick: () => {
                        this.#selectedContextId = resource.id;
                        this.tbody.querySelectorAll(".selected").forEach(r => r.classList.remove("selected"));
                        row.classList.add("selected");
                    },
                    inner: [{ tag: "td" }, { tag: "td" }, { tag: "td" }]
                });
                this.#rowCache.set(resource.id, row);
            }

            this.tbody.appendChild(row);

            if (isSelected) row.classList.add("selected");
            else row.classList.remove("selected");

            if (row._lastIcon !== iconParam || row._lastName !== nameParam) {
                row.cells[0].innerHTML = "";
                const iconSrc = iconParam ? website.cdn + "/file/" + iconParam : null;
                const elems = [
                    iconSrc ? { tag: "img", src: iconSrc, style: "width: 16px; height: 16px; margin-right: 5px; vertical-align: middle;", onerror: "this.style.display='none';" }
                        : { tag: "i", class: "bi bi-app-indicator", style: "margin-right: 5px;" },
                    { tag: "span", text: nameParam }
                ];
                elems.forEach(c => row.cells[0].appendChild(LS.Create(c)));
                row._lastIcon = iconParam;
                row._lastName = nameParam;
            }

            if (row.cells[1].textContent !== type)
                row.cells[1].textContent = type;

            if (row.cells[2].textContent !== resource.state)
                row.cells[2].textContent = resource.state;
        }

        for (const [id, row] of this.#rowCache) {
            if (!activeIds.has(id)) {
                row.remove();
                this.#rowCache.delete(id);
            }
        }
    }

    listResources() {
        return this.#kernel.contexts.values();
    }

    destroy() {
        this.#rowCache.clear();
        this.window.destroy();
        this.#kernel = null;
        super.destroy();
    }
}

export default ResourceMonitor;