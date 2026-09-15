/**
 * Work in progress!
 * TODO: Requires a lot of refactoration; this is a replacement design to the original /home settings page,
 * TODO: merged with LSCS settings, but there is still a long way to go
 */

/*
 * ---- Helper functions
 */

function m_category(title) {
    const el = document.createElement("span");
    el.className = "menu-category-title";
    el.textContent = title;
    return el;
}

function m_button(icon, label, tabId) {
    const button = document.createElement("button");
    button.className = "elevated";
    button.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
    button.setAttribute("data-tab-id", tabId);
    return button;
}

function m_button_group(buttons) {
    const group = document.createElement("div");
    group.className = "grouped-buttons";
    buttons.forEach(button => {
        group.appendChild(button);
    });
    return group;
}

/**
 * SettingsPage class represents the settings page of the application.
 */
class SettingsPage {
    /**
     * @type {LS.Tabs}
     */
    tabs = null;

    /**
     * @type {LS.InputGroup}
     */
    inputGroup = null;

    /**
     * @type {LS.Modal}
     */
    modal = null;

    /**
     * @param {LS.Modal} modal
     */
    constructor(modal) {
        this.modal = modal;

        // todo
        const container = modal.container;
        container.classList.add('preferences-modal');

        const modalElement = container.querySelector("#preferences-modal");
        modalElement.style.display = 'flex';
        modalElement.querySelector(".menu-button").addEventListener('click', () => {
            container.classList.toggle("sidebar-menu-visible");
        });

        this.tabs = new LS.Tabs(LS.Create("div.sidebar-content"), {
            list: false,
            parent: modalElement,
            slideAnimation: true
        });

        const menu = container.querySelector(".menu");

        this.inputGroup = new LS.InputGroup(null, null, {
            async fetchData() {
                // todo: unified user data source (this will later be extended in multiple ways).
                return app.userFragment;
            },

            // This is called when the input needs to refresh its value
            updateCallback(input, data) {
                if(input.userData) {
                    const path = input.userData.split(".");
                    return path.reduce((obj, key) => obj?.[key], data);
                }
            },

            changeCallback(input, isFinal, value) {
                if(!isFinal) return;

                const path = input.userData.split(".");
                const changes = {};

                // Build the nested object structure based on the path
                let current = changes;
                for(let i = 0; i < path.length - 1; i++) {
                    current[path[i]] = {};
                    current = current[path[i]];
                }
                current[path[path.length - 1]] = value;

                input.inputElement.disabled = true;
                input.inputElement.setAttribute("data-ls-state", "loading");
                userUpdate(changes).then(() => {
                    input.inputElement.setAttribute("data-ls-state", "success");
                }).catch((err) => {
                    console.error(err);
                    input.inputElement.setAttribute("data-ls-state", "error");
                    LS.Toast.show("Error updating settings: " + (err.message || err), { accent: "red" });
                }).finally(() => {
                    input.inputElement.disabled = false;
                });
            }
        });

        this.#setupSidebar();
        this.#setupTabContent();

        // Request the initial data for the input group to populate the inputs with current values
        this.inputGroup.updateData();

        // Tab change listener
        this.tabs.on("change", async (tabId) => {
            const buttons = menu.querySelectorAll("button");
            buttons.forEach(button => {
                if(button.getAttribute("data-tab-id") === tabId) {
                    button.classList.add("active");
                    button.classList.add("level-1");
                } else {
                    button.classList.remove("active");
                    button.classList.remove("level-1");
                }
            });

            if(tabId === "behaviors") {
                const addons = await api.getAddons();

                inputGroup.get("initiator-select").setSelectOptions(addons.initiators.map(i => ({ value: i.name, label: i.name })));
                inputGroup.get("steering-select").setSelectOptions(addons.steerings.map(s => ({ value: s.name, label: s.name })));
            }

            if(tabId === "extensions") {
                // TODO: i was lazy here
                const user = await api.getUser();

                const addons = await api.getAddons();

                const container = document.getElementById("ui-settings-extensions");
                container.replaceChildren();

                addons.modules.forEach(addon => {
                    const addonElement = LS.Create({
                        class: "addon-card" + (user.modelSettings.modules?.includes(addon.name) ? " enabled" : "") + (addon.nsfw ? " is-nsfw" : ""),
                        inner: [
                            {
                                class: "addon-header",
                                inner: [
                                    (addon.icon && !addon.icon.startsWith(":"))? { tag: "img", src: "backend/fragments/modules/" + addon.name + "/" + addon.icon, class: "addon-icon" } : null,
                                    { tag: "strong", inner: addon.name },
                                    { tag: "p", inner: addon.description || "No description provided." },
                                    [{ emmet: "ls-box.inline", inner: addon.category || "No category." }],
                                    { tag: "p", inner: `Version: ${addon.version || "N/A"}` },
                                ]
                            },
                            addon.banner? { tag: "img", src: "backend/fragments/modules/" + addon.name + "/" + addon.banner, class: "addon-banner" } : null
                        ],
                        onclick: async () => {
                            const isEnabled = user.modelSettings.modules?.includes(addon.name);
                            let newModules;
                            if(isEnabled) {
                                newModules = user.modelSettings.modules.filter(m => m !== addon.name);
                            } else {
                                newModules = [...(user.modelSettings.modules || []), addon.name];
                            }

                            await userUpdate({ modelSettings: { modules: newModules.filter(Boolean) } });

                            user.modelSettings.modules = newModules;

                            if(isEnabled) {
                                addonElement.classList.remove("enabled");
                            } else {
                                addonElement.classList.add("enabled");
                            }
                        }
                    });

                    container.appendChild(addonElement);
                });
            }

            if(tabId === "personas") {
                const personas = await api.listPersonas();

                const container = document.getElementById("ui-settings-personas");
                container.replaceChildren();

                personas.forEach(persona => {
                    const personaElement = LS.Create({
                        class: "persona-entry",
                        inner: [
                            { tag: "h3", inner: persona.name },
                            { tag: "p", inner: `ID: ${persona.id}` }
                        ]
                    });

                    container.appendChild(personaElement);
                });
            }
        });

        // Set the initial tab
        this.tabs.set("main", true);
    }

    /**
     * Sets up the sidebar.
     */
    #setupSidebar() {
        const menu = this.modal.container.querySelector(".menu");

        menu.addEventListener("click", (event) => {
            const button = event.target.closest("button");
            if(button) {
                const tabId = button.getAttribute("data-tab-id");
                if(tabId) {
                    this.tabs.set(tabId);
                }
            }
        });

        // ---- Sidebar buttons

        menu.appendChild(m_button_group([
            m_button("ph ph-house", "Main", "main")
        ]));

        menu.appendChild(m_category("Interface"));
        menu.appendChild(m_button_group([
            m_button("ph ph-palette", "Appearance", "appearance"),
            m_button("ph ph-keyboard", "Keyboard Shortcuts", "keyboard"),
            m_button("ph ph-layout", "Layout", "layout")
        ]));
    }

    /**
     * Sets up the content for each tab.
     */
    #setupTabContent() {}
}


let modal, settings;

function openPage(tabId) {
    modal.open();
    settings.tabs.set(tabId);
}

function createModal(settingsContent) {
    modal = LS.Modal.build({
        content: settingsContent
    }, {
        width: '1065px'
    });

    modal.once('open', () => {
        settings = new SettingsPage(modal);
    });

    return modal;
}

export { openPage, createModal };