class ResourceMonitor extends website.ContentContext {
    static #suspendWarningShown = false;

    #kernel = null;
    #selectedContextId = null;
    #rowCache = new Map();
    #suspendResumeButton = null;
    #loadingPollPending = false;
    #destroying = false;
    frameScheduler = null;

    constructor() {
        super({
            id: "resource-monitor",
            title: "Resource Monitor",
            icon: "79fb1a87322b7fa0.svg",
        });

        // This will throw and self destruct if not available
        this.#kernel = this.requestKernelAccess();

        // Setup content
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
                            { tag: "button", text: "Refresh", onclick: () => this.#scheduleRefresh() },
                            { tag: "button", inner: [{ tag: "i", class: "bi-trash-fill" }, "Clear all suspended"], class: "elevated", onclick: () => this.#kernel.clearAllOtherPages() },
                        ],

                        [
                            (this.#suspendResumeButton = LS.Create({
                                tag: "button",
                                class: "elevated",
                                style: "padding-inline: .55rem; min-width: 2.1rem;",
                                title: "Suspend selected context",
                                disabled: true,
                                inner: [{ tag: "i", class: "bi-pause-fill" }],
                                onclick: () => this.action('toggle-suspend')
                            })),
                            { tag: "button", class: "elevated", inner: [{ tag: "i", class: "bi-stop-fill" }, "Stop"], accent: "red", onclick: () => this.action('stop') }
                        ]
                    ]
                }
            ]
        }));

        // Only update the list at most once per frame; should not be an issue, but just in case, + resource manager should be responsive
        this.frameScheduler = this.addDestroyable(new LS.Util.FrameScheduler(() => this.#onFrameTick()));
        this.frameScheduler.limitFPS(15);

        // Listen to kernel events
        this.addExternalEventListener(this.#kernel, "context-created", () => this.#scheduleRefresh());
        this.addExternalEventListener(this.#kernel, "context-updated", () => this.#scheduleRefresh());
        this.addExternalEventListener(this.#kernel, "context-destroyed", () => this.#scheduleRefresh());

        this.window = this.createWindow({
            title: "Resource Monitor",
            width: 650,
            height: 340,
            minWidth: 450,
            minHeight: 200
        });

        this.updateList();
        this.#updateActionButtons();
    }

    async action(type) {
        const context = this.#getSelectedContext();
        if (!context) return;

        if (type === "toggle-suspend") {
            type = context.state === "suspended" ? "resume" : "suspend";
        }

        if (type === "suspend") {
            const shouldContinue = await this.#confirmExperimentalSuspend();
            if (!shouldContinue || this.destroyed) return;
        }

        if(type !== 'stop' && context.id === this.id) {
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
        this.#scheduleRefresh();
        this.#updateActionButtons();
    }

    updateList() {
        if (this.destroyed || !this.#kernel || !this.tbody) return;

        // Ensure we don't keep any references to the context itself, just collect and display its information
        const resources = this.listResources();
        const activeIds = new Set();
        let hasLoadingResource = false;

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
                        this.#updateActionButtons();
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
                row.cells[0].append(website.views.getAppIconView(resource), LS.Create({ tag: "span", text: nameParam }));
                row._lastIcon = iconParam;
                row._lastName = nameParam;
            }

            if (row.cells[1].textContent !== type)
                row.cells[1].textContent = type;

            if (row.cells[2].textContent !== resource.state)
                row.cells[2].textContent = resource.state;

            if (resource.state === "loading") {
                hasLoadingResource = true;
            }
        }

        for (const [id, row] of this.#rowCache) {
            if (!activeIds.has(id)) {
                row.remove();
                this.#rowCache.delete(id);

                if (this.#selectedContextId === id) {
                    this.#selectedContextId = null;
                }
            }
        }

        this.#updateActionButtons();

        // Some state transitions (for example loading -> ready) may happen without a
        // kernel-level event, so keep refreshing while any context is still loading.
        if (hasLoadingResource && !this.#loadingPollPending) {
            this.#loadingPollPending = true;
            this.setTimeout(() => {
                this.#loadingPollPending = false;
                this.#scheduleRefresh();
            }, 180);
        }
    }

    listResources() {
        if (!this.#kernel) return [];
        return this.#kernel.contexts.values();
    }

    #onFrameTick() {
        if (this.destroyed) return;
        this.updateList();
    }

    #scheduleRefresh() {
        if (this.destroyed || !this.frameScheduler) return;
        this.frameScheduler.schedule?.();
    }

    async #confirmExperimentalSuspend() {
        if (ResourceMonitor.#suspendWarningShown) return true;

        return await new Promise((resolve) => {
            let settled = false;
            const settle = (value) => {
                if (modal) modal.close(), modal = null;
                if (settled) return;
                settled = true;

                if(value) ResourceMonitor.#suspendWarningShown = true;
                resolve(value);
            };

            let modal = LS.Modal.buildEphemeral({
                title: "Experimental Feature",
                content: "Suspending contexts is experimental and not intended for manual use.\nThis could cause unintended behavior, including broken app state.\nDo you want to continue?",
                buttons: [
                    { label: "Cancel", class: "elevated", onClick: () => settle(false) },
                    { label: "Continue", accent: "orange", onClick: () => settle(true) }
                ],
                onClose: () => settle(false)
            });
        });
    }

    #getSelectedContext() {
        if (!this.#selectedContextId || !this.#kernel) return null;
        return [...this.#kernel.contexts.values()].find(c => c.id === this.#selectedContextId) || null;
    }

    #updateActionButtons() {
        const context = this.#getSelectedContext();
        if (!this.#suspendResumeButton) return;

        const disabled = !context || context.id === this.id;
        this.#suspendResumeButton.disabled = disabled;

        const icon = context?.state === "suspended" ? "bi-play-fill" : "bi-pause-fill";
        this.#suspendResumeButton.title = context?.state === "suspended"
            ? "Resume selected context"
            : "Suspend selected context";

        const iconElement = this.#suspendResumeButton.querySelector("i");
        if (iconElement && iconElement.className !== icon) {
            iconElement.className = icon;
        }
    }

    #formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    }

    destroy() {
        if (this.destroyed || this.#destroying) return;
        this.#destroying = true;

        this.frameScheduler = null;
        this.#loadingPollPending = false;
        this.#rowCache.clear();
        this.window.destroy();
        this.#kernel = null;
        super.destroy();
    }
}

export default ResourceMonitor;