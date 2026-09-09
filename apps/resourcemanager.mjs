class ResourceMonitor extends website.ContentContext {
    static #suspendWarningShown = false;

    #kernel = null;
    #kernelPromise = null;
    #selectedContextId = null;
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
        this.#kernelPromise = this.requestKernelAccess("Access is required to list and manage apps & resources.");

        // Virtualized process list
        this.treeView = new LS.Tree({
            rowHeight: 32,

            createNode(){
                return LS.Create({
                    tag: "div",
                    class: "resource-node",
                    inner: [
                        { tag: "div", class: "name" },
                        // { tag: "div", class: "type" },
                        { tag: "div", class: "status" }
                    ]
                });
            },

            updateNode(node, element){
                if (node.isSelected) element.classList.add("selected");
                else element.classList.remove("selected");

                const cells = element.querySelectorAll("div");

                if (element._lastIcon !== node.icon || element._lastName !== node.label) {
                    cells[0].replaceChildren();
                    cells[0].append(website.views.getAppIconView(node), LS.Create({ tag: "span", text: node.label }));
                    element._lastIcon = node.icon;
                    element._lastName = node.label;
                }

                // if (cells[1].textContent !== node.type)
                //     cells[1].textContent = node.type;

                if (cells[1].textContent !== node.resourceState) {
                    cells[1].textContent = node.resourceState;
                    element.style.opacity = node.resourceState === "suspended"? "0.5": "";
                }
            }
        });

        this.treeView.on("click", (node) => {
            this.#selectedContextId = node.id;
            this.#updateActionButtons();
        });

        // Setup content
        this.fromElement(LS.Create({
            tag: "div",
            class: "resource-monitor",
            attributes: { "data-ls-state": "loading" },
            inner: [
                { tag: "div", class: "resource-list", style: "flex-grow: 1; height: 100%;", inner: {
                    // tag: "table",
                    class: "clear",
                    inner: [
                        // {
                        //     tag: "thead", inner: [
                        //         {
                        //             tag: "tr", inner: [
                        //                 { tag: "th", text: "Name" },
                        //                 { tag: "th", text: "Type" },
                        //                 { tag: "th", text: "Status" }
                        //             ]
                        //         }
                        //     ]
                        // },
                        this.treeView.container
                    ]
                } },
                {
                    tag: "div", inner: [
                        [
                            { tag: "button", text: "Refresh", onclick: () => this.#scheduleRefresh() },
                            { tag: "button", inner: [{ tag: "i", class: "bi-trash-fill" }, "Clear suspended"], class: "elevated", onclick: () => this.#kernel.clearAllOtherPages() },
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
        this.addExternalEventListener(this.#kernel, "context-created",   () => this.#scheduleRefresh());
        this.addExternalEventListener(this.#kernel, "context-updated",   () => this.#scheduleRefresh());
        this.addExternalEventListener(this.#kernel, "context-destroyed", () => this.#scheduleRefresh());

        this.window = this.createWindow({
            title: "Resource Monitor",
            width: 650,
            height: 340,
            minWidth: 450,
            minHeight: 200
        });

        this.#kernelPromise.then(kernel => {
            if (this.destroyed) return;
            this.#kernel = kernel;
            this.updateList();
            this.#updateActionButtons();
            this.content.setAttribute("data-ls-state", "ready");
        }).catch(() => {
            if (this.destroyed) return;
            LS.Toast.show("Failed to access kernel. The Resource Monitor cannot function without it.", { accent: "red" });
            this.window.close();
        });
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
        if (this.destroyed || !this.#kernel || !this.treeView) return;

        // Ensure we don't keep any references to the context itself, just collect and display its information
        const resources = this.listResources();
        const activeIds = new Set();
        let hasLoadingResource = false;
        const newNodes = [...resources.map(resource => {
            activeIds.add(resource.id);

            const isSelected = resource.id === this.#selectedContextId;
            const type = resource.constructor.name === "ContentContext" && resource.path ? "Page" : resource.constructor.name;

            if (resource.state === "loading") {
                hasLoadingResource = true;
            }

            return {
                id: resource.id,
                icon: resource.icon,
                label: resource.visibleName || resource.id,
                type,
                depth: 0,
                resourceState: resource.state,
                isSelected
            }
        })];

        // TODO: should be possible to just update changes
        this.treeView.loadData(newNodes);

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
        return this.#kernel.listResources();
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
        this.window.destroy();

        if(this.treeView) {
            this.treeView.destroy();
            this.treeView = null;
        }

        this.#kernel = null;
        super.destroy();
    }
}

export default ResourceMonitor;