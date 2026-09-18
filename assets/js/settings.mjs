/**
 * Work in progress!
 * TODO: Requires a lot of refactoration; this is a replacement design to the original /home settings page,
 * TODO: merged with LSCS settings, but there is still a long way to go
 */

/**
 * Settings class represents the settings/config modal of the application.
 */
class Settings {
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

    initialized = false;

    /**
     * @param {LS.Modal} modal
     */
    constructor(options = {}) {
        this.modal = LS.Modal.build({
            content: options.content || LS.Create("#preferences-modal", {
                inner: [
                    { tag: "button", class: "menu-button clear square", hidden: true, inner: [{ tag: "i", class: "ph ph-sidebar-simple bi-layout-sidebar" }] },
                    { class: "menu sidebar-items level-n1" }
                ]
            })
        }, {
            width: '1065px'
        });

        // Initialize settings when the modal is opened
        this.modal.once('open', () => {
            this.init();
        });
    }

    /**
     * Initialize the settings.
     */
    init() {
        if(this.initialized) return;
        this.initialized = true;

        // todo
        const container = this.modal.container;
        container.classList.add('preferences-modal');

        const modalElement = LS.SelectOrCreate("#preferences-modal", container);
        modalElement.style.display = 'flex';
        modalElement.querySelector(".menu-button").addEventListener('click', () => {
            // Menu view toggle
            container.classList.toggle("sidebar-menu-visible");
        });

        const menu = container.querySelector(".menu");

        // Tabs for the content
        this.tabs = new LS.Tabs(LS.Create(".sidebar-content"), {
            list: false,
            parent: modalElement,
            slideAnimation: true
        });

        // // Tabs for the sidebar
        // this.sidebarTabs = new LS.Tabs(LS.Create(".menu"), {
        //     list: false,
        //     parent: menu,
        //     slideAnimation: true
        // });

        let changes = {};

        // Inputgroup is the central abstraction for collecting inputs & updating them.
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
                    changes = {};
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
            m_button("ph ph-house bi-house-fill", "Main", "main")
        ]));

        menu.appendChild(m_category("Interface"));
        menu.appendChild(m_button_group([
            m_button("ph ph-palette bi-palette2", "Appearance", "appearance"),
            m_button("ph ph-keyboard bi-keyboard-fill", "Keyboard Shortcuts", "keyboard"),
            m_button("ph ph-layout bi-columns", "Layout", "layout")
        ]));
    }

    /**
     * Sets up the content for each tab.
     */
    #setupTabContent() {
        this.tabs.add("main", LS.Create({
            inner: [
                { tag: "h2", inner: "Main Settings" },
                { tag: "p", inner: "Configure the main settings of the application." }
            ]
        }));

        this.tabs.add("appearance", LS.Create({}));

        this.tabs.add("keyboard", LS.Create({}));

        this.tabs.add("layout", LS.Create({}));
    }
}


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
 * @type {Settings}
 */
let settings;

function openPage(tabId) {
    settings.init();
    settings.tabs.set(tabId);
    settings.modal.open();
}

function createModal(options) {
    if(settings) {
        return settings;
    }

    return (settings = new Settings(options));
}

export { openPage, createModal };