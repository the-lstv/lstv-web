/**
 * TODO: Requires a lot of refactoration, this is temporary
 */

/**
 * Main page module
 */
website.register(document.currentScript, class {
    constructor(context, container) {
        this.context = context;
        this.context.setOptions({
            dynamicAccount: true,
            path: "/home"
        });

        this.container = container;
        this.auth = context.requestPermission(["auth"]).auth;
        this.siteScriptsOnce = new Set();
        this.tabHandlers = {};
        this.init();
    }

    init() {
        // -- SPA Extensions
        this.context.registerSPAExtension("/home/{,*}", (page) => {
            this.handleNavigation();
        });

        this.context.registerSPAExtension("/home/applications/{*,*/details,*/store,*/team,*/delete}", (page) => {
            this.handleNavigation();
        });


        // -- DOM elements
        this.panel = this.container.querySelector('.container');
        this.panelContent = this.container.querySelector(".settings-container");

        this.loginSwitch = new LS.Util.ElementSwitch([this.container.querySelector('.loadingIndicator'), LS.Create('div', {
            class: "login-notice container-content",
            inner: [
                N("h3", "You are not logged in"),
                N("button", {
                    textContent: "Log in",
                    class: "pill",
                    onclick: () => website.showLoginToolbar()
                })
            ]
        }), this.panelContent], null, {
            mode: "dom",
            parent: this.panel,
            initial: -1
        });

        const menuButton = this.container.querySelector('.menu-button');
        menuButton.addEventListener("click", () => this.panel.toggleClass('sidebar-menu-visible'));

        // -- Tabs
        this.tabs = new LS.Tabs(this.panelContent.querySelector('.sidebar-content'), {
            list: false,
            slideAnimation: true
        });

        this.sidebarTabs = new LS.Tabs(this.panelContent.querySelector('.menu'), {
            list: false,
            slideAnimation: true
        });

        // -- Lifecycle
        this.tabs.on("changed", (tab) => this.handleTabChange(tab));
        this.context.on("destroy", () => this.destroy());
        window.s = this;

        // First thing that we do, is we wait for the user state to be ready.
        // Once that happens this callback will be called, including future changes, as this page should update user state dynamically.
        website.watchUser((loggedIn, userFragment) => {
            this.handleUserStateChange(loggedIn);
        });
    }

    handleUserStateChange(loggedIn) {
        if (!loggedIn) {
            this.loginSwitch.set(1);
            return;
        }

        this.loginSwitch.front();

        if (!this.firstLoadDone) {
            this.firstLoadDone = true;
            this.panelContent.style.display = "";
            this.handleNavigation();
        }
    }
    
    handleNavigation() {
        const segments = location.pathname.split("/").filter(Boolean);
        segments.shift();

        switch(segments[0]) {
            case "applications":
                if (segments[1]) {
                    if(segments[2] === "delete") {
                        LS.Modal.buildEphemeral({
                            title: "Are you sure?",
                            content: LS.Create({ innerHTML: "This will permanently delete your application and any related resources.<br><br>You can restore it within 30 days." }),
                            buttons: [{ label: "Cancel", class: "elevated" },  { label: "Continue", accent: "red" }]
                        });
                        return;
                    }

                    if(!this.developerAppEditor) this.developerAppEditor = new DeveloperAppEditor(this);
                    this.tabs.set("applications/" + (segments[2] || "details"));
                    break;
                }

            default:
                this.tabs.set(segments[0] || "home");
                this.sidebarTabs.set("home");
                break;
        }
    }

    handleTabChange(tab) {
        const view = this.tabs.currentElement();
        this.panel.classList.remove('sidebar-menu-visible');

        let sidebarTab = "home";

        if (tab.startsWith("applications")) {
            if(!this.developerAppEditor) this.developerAppEditor = new DeveloperAppEditor(this);

            if(tab.indexOf("/") !== -1) {
                if(!tab.endsWith("/create")) {
                    sidebarTab = "application";
                    this.developerAppEditor.load();
                }
    
                // TODO
            }
        }

        this.sidebarTabs.set(sidebarTab);

        if (!this.siteScriptsOnce.has(tab)) {
            if (tab === "profile" && !this.tabHandlers.profile) {
                this.tabHandlers.profile = new ProfileHandler(this.container, this.auth);
                this.tabHandlers.profile?.init();
            } else if (tab === "account" && !this.tabHandlers.account) {
                this.tabHandlers.account = new AccountHandler(this.container, this.auth);
                this.tabHandlers.account?.init();
            } else if (tab === "applications" && !this.tabHandlers.applications) {
                this.tabHandlers.applications = new ApplicationsHandler(this, this.developerAppEditor, this.tabs);
                this.tabHandlers.applications?.init();
            }

            this.siteScriptsOnce.add(tab);
        }

        this.container.querySelector('.title').textContent = view.getAttribute("tab-title") || "User Settings";

        const button = this.container.querySelector(`[data-tab-id="${tab}"]`);
        const activeButton = this.container.querySelector(`.menu .active`);

        if (activeButton) {
            activeButton.classList.remove('active', 'level-1');
        }

        if (button) {
            button.classList.add('active', 'level-1');
        }
    }

    destroy() {
        this.tabs.destroy();
        this.tabs = null;

        this.sidebarTabs.destroy();
        this.sidebarTabs = null;

        this.loginSwitch.destroy();
        this.loginSwitch = null;

        this.developerAppEditor.destroy();
        this.developerAppEditor = null;

        for (const handlerKey in this.tabHandlers) {
            this.tabHandlers[handlerKey].destroy();
        }
        this.tabHandlers = {};

        this.container = null;
        this.context = null;
        this.auth = null;
        this.panel = null;
        this.panelContent = null;
        this.__destroyed = true;
    }
});


// Constants
const APP_CATEGORY_ICONS = {
    web: "bi-globe",
    widget: "bi-app-indicator",
    software: "bi-laptop",
    mobile: "bi-phone",
    game: "bi-controller",
    bot: "bi-robot",
    api: "bi-code-slash",
    other: "bi-three-dots"
};


/**
 * Manages developer applications
 */
class DeveloperAppEditor {
    constructor(context) {
        this.context = context;
        this.currentAppId = null;
        this.list = [];

        this.loadingSwitch = new LS.Util.ElementSwitch(context.panelContent.querySelectorAll('#dev-apps-list :is(.loadingIndicator, .loadingContent)'), null, { mode: "dom", parent: context.panelContent.querySelector('#dev-apps-list') });
    }

    update() {
        this.loadingSwitch.back();

        website.fetch("v1/apps/list?publisher=@me", {}, (error, response) => {
            if (error) {
                console.error("Failed to fetch app list:", error);
                return;
            }

            const listElement = this.loadingSwitch.frontElement;
            listElement.innerHTML = "";

            for (let app of response) {
                if(!app.previewElement) app.previewElement = LS.Create("a", {
                    class: "app-entry ls-plain",
                    href: "/home/applications/" + app.id + "/details",
                    inner: [
                        {
                            class: "app-icon",
                            inner: [
                                app.icon ? LS.Create('img', {
                                    class: "elevated app-icon",
                                    src: website.cdn + "/file/" + app.icon,
                                    alt: app.name + " icon"
                                }) : LS.Create('ls-box', {
                                    class: "elevated placeholder-icon app-icon",
                                    inner: [N("i", { class: APP_CATEGORY_ICONS[app.category] || "bi-app-indicator" })]
                                })
                            ]
                        },
                        {
                            class: "app-info",
                            inner: [
                                { tag: "span", inner: app.id, class: "app-id text-overflow-nowrap" },
                                { tag: "span", inner: " " + app.name, class: "app-name text-overflow-nowrap" }
                            ]
                        }
                    ]
                });

                listElement.appendChild(app.previewElement);
            }

            this.list = response;
            this.loadingSwitch.front();
        });
    }

    async load() {
        const segments = location.href.split("/");
        const appId = segments[segments.indexOf("applications") + 1];
        this.currentAppId = appId;

        if (!website.isLoggedIn) return;

        website.fetch("v1/apps/info/?id=" + appId, {}, (error, app) => {
            if (error || !app || !app.owned) {
                console.error("Failed to fetch app info:", error);
                LS.Modal.buildEphemeral({
                    title: "Could not load app",
                    content: (app && !app.owned)
                        ? "You do not have permission to edit this app."
                        : error.error || error.message || "An unknown error occurred while loading the app. Please try again later.",
                    buttons: [{ label: "Ok", class: "elevated" }]
                });
                return;
            }

            for (const element of this.context.panelContent.querySelectorAll('.menu [tab-id="application"] [base-href]')) {
                element.setAttribute("href", element.getAttribute("base-href").replace("$id", appId));
            }
        });
    }

    destroy() {
        this.loadingSwitch.destroy();
    }
}


/**
 * Handles user profile editing
 */
class ProfileHandler {
    constructor(container, auth) {
        this.container = container;
        this.auth = auth;
        this.blobs = {};
        this.editingUser = LS.Reactive.fork("editingUser", website.userFragment);
        this.confirmButtons = container.get('.profile-editor-confirm-buttons');
    }

    init() {
        this.setupUserWatcher();
        this.setupEventListeners();
        this.setupExternalLinks();
    }

    setupUserWatcher() {
        this.editingUser.__binding.on("mutated", () => {
            this.confirmButtons.classList.add("visible");
        });

        this.editingUser.__binding.on("reset", () => {
            this.updateTextAreaLength();
        });

        website.watchUser((loggedIn, userFragment) => {
            if (loggedIn) {
                this.editingUser.__reset();
            }
        });

        window.addEventListener('beforeunload', (e) => {
            if (!this.confirmButtons.classList.contains("visible")) return;
            e.preventDefault();
            e.returnValue = '';
        });
    }

    setupEventListeners() {
        this.container.get("#profile-avatar").on("change", () => this.handleAvatarChange());
        this.container.get("#profile-remove-avatar").on("click", () => this.handleRemoveAvatar());
        this.container.get("#profile-banner").on("change", () => this.handleBannerChange());
        this.container.get("#profile-remove-banner").on("click", () => this.handleRemoveBanner());
        this.container.get("#profile-displayname").on("input", (e) => this.editingUser.displayname = e.target.value);
        this.container.get("#profile-about").on("input", (e) => {
            this.editingUser.bio = e.target.value;
            this.updateTextAreaLength();
        });
        this.container.get("#profile-save").on("click", () => this.saveProfile());
        this.container.get("#profile-reset").on("click", () => this.resetProfile());
        this.container.get("#mature-content").on("change", (e) => this.editingUser.mature_content = e.target.checked);
        this.container.get("#fullscreen-banner").on("change", (e) => this.editingUser.fullscreen_banner = e.target.checked);
        this.container.get("#secret-glossy-style").on("change", (e) => this.editingUser.profile_style = e.target.checked ? "glossy" : null);
    }

    setupExternalLinks() {
        const links_table = this.container.get("#links");
        for (const link of website.userFragment.external_links || []) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${link.platform}</td>
                <td><input type="text" name="link-${link.platform}" value="${link.url}" /></td>
            `;
            links_table.appendChild(row);
        }
    }

    handleAvatarChange() {
        const file = this.container.get("#profile-avatar").files[0];
        if (file) {
            this.openCropper(file, {
                width: 256,
                height: 256,
                shape: "circle",
                field: "pfp",
                animated: true
            });
        }
    }

    handleRemoveAvatar() {
        this.editingUser.pfp = null;
    }

    handleBannerChange() {
        const file = this.container.get("#profile-banner").files[0];
        if (!file) return;

        const fullscreenBanner = this.container.get(".profile-editor-container .profile").classList.contains("fullscreen-banner");
        const width = fullscreenBanner ? 170 : 340;
        const height = fullscreenBanner ? 240 : 160;

        this.openCropper(file, {
            width,
            height,
            finalWidth: width * 2,
            finalHeight: height * 2,
            field: "banner",
            animated: true
        });
    }

    handleRemoveBanner() {
        this.editingUser.banner = null;
    }

    updateTextAreaLength() {
        const lengthElement = this.container.get('#profile-about-length');
        const textArea = this.container.get("#profile-about");
        if (lengthElement) {
            lengthElement.textContent = `${textArea.value.length}/500`;
        }
    }

    openCropper(file, options) {
        if (!LS.ImageCropper) {
            console.error("ImageCropper module not loaded (yet).");
            return;
        }

        const cropper = new LS.ImageCropper(file, {
            ...options,
            createURL: true,
            onResult: (result) => {
                modal.close();
                this.blobs[options.field] = result;
                this.editingUser[`__animated_${options.field}`] = result.animated;
                this.editingUser[options.field] = this.blobs[options.field].url;
            },
            onError: () => {
                LS.Modal.buildEphemeral({
                    title: "Crop failed",
                    content: "Sorry, an error occurred while cropping or loading your image. Please try again later.",
                    buttons: [{ label: "Ok" }]
                });
                modal.close();
            }
        });

        const modal = LS.Modal.buildEphemeral({
            title: "Crop image",
            content: cropper.wrapper,
            buttons: [
                { class: "elevated", label: "Cancel" },
                {
                    label: "Crop",
                    onClick: () => cropper.crop()
                }
            ]
        }, { canClickAway: false });

        modal.on("close", () => {
            setTimeout(() => cropper.destroy(), 1000);
        });
    }

    async saveProfile() {
        this.disableButtons();

        if (this.blobs.pfp || this.blobs.banner) {
            const uploadSuccess = await this.uploadMedia();
            if (!uploadSuccess) {
                this.enableButtons();
                return;
            }
        }

        const patch = this.editingUser.__data;
        if (this.blobs.pfp?.uploadResult) patch.pfp = this.blobs.pfp.uploadResult.name;
        if (this.blobs.banner?.uploadResult) patch.banner = this.blobs.banner.uploadResult.name;

        this.auth.patch(patch, (error) => {
            this.enableButtons();
            if (error) {
                LS.Modal.buildEphemeral({
                    title: "Update failed",
                    content: error.error || error.message || "Sorry, an error occurred while updating your profile. Please try again later.",
                    buttons: [{ label: "Ok" }]
                });
                return;
            }

            this.confirmButtons.classList.remove("visible");
            this.cleanupBlobs();
            LS.Toast.show("Profile updated successfully!", { timeout: 3000 });
            this.editingUser.__reset();
        });
    }

    async uploadMedia() {
        try {
            const formData = new FormData();
            if (this.blobs.pfp) {
                formData.append("file", this.blobs.pfp.blob, "avatar." + (this.editingUser.__animated_pfp ? "webm" : "webp"));
            }
            if (this.blobs.banner) {
                formData.append("file", this.blobs.banner.blob, "banner." + (this.editingUser.__animated_banner ? "webm" : "webp"));
            }

            const response = await fetch(website.cdn + "/upload?intent=avatar&origin_id=" + this.editingUser.id, {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Failed to upload media");

            const result = await response.json();
            if (result?.length > 0) {
                if (this.blobs.pfp) this.blobs.pfp.uploadResult = result.find(file => file.originalName.startsWith("avatar"));
                if (this.blobs.banner) this.blobs.banner.uploadResult = result.find(file => file.originalName.startsWith("banner"));
            }
            return true;
        } catch (error) {
            console.error("Error uploading media:", error);
            LS.Modal.buildEphemeral({
                title: "Upload failed",
                content: "Sorry, an error occurred while uploading your media. Please try again later.",
                buttons: [{ label: "Ok" }]
            });
            return false;
        }
    }

    resetProfile() {
        this.editingUser.__reset();
        this.blobs.pfp = null;
        this.blobs.banner = null;
        this.confirmButtons.classList.remove("visible");
    }

    cleanupBlobs() {
        if (this.blobs.pfp) {
            URL.revokeObjectURL(this.blobs.pfp.url);
            this.blobs.pfp = null;
        }
        if (this.blobs.banner) {
            URL.revokeObjectURL(this.blobs.banner.url);
            this.blobs.banner = null;
        }
    }

    disableButtons() {
        this.confirmButtons.getAll("button").forEach(button => button.attrAssign("disabled"));
    }

    enableButtons() {
        this.confirmButtons.getAll("button").forEach(button => button.removeAttribute("disabled"));
    }
}


/**
 * Handles account settings
 */
class AccountHandler {
    constructor(container, auth) {
        this.container = container;
        this.auth = auth;
    }

    init() {
        this.setupModal();
        this.setupEventListeners();
    }

    setupModal() {
        const newPasswordField = N([
            N("label", { textContent: "New password:", attr: { for: "new-password" } }),
            N("input", { type: "password", id: "new-password", attr: { autocomplete: "new-password" } }),
            N("label", { textContent: "Confirm new password:", attr: { for: "confirm-new-password" } }),
            N("input", { type: "password", id: "confirm-new-password", attr: { autocomplete: "new-password" } })
        ]);

        this.newPasswordField = newPasswordField;
        this.confirmationModal = LS.Modal.build({
            title: "Confirm Changes",
            content: [
                N("label", { textContent: "Current password:", attr: { for: "current-password" } }),
                N("input", { type: "password", id: "current-password", attr: { autocomplete: "current-password" } }),
                newPasswordField
            ],
            buttons: [
                { label: "Cancel", class: "elevated" },
                {
                    label: "Confirm",
                    onClick: () => this.handleConfirm()
                }
            ]
        });
    }

    setupEventListeners() {
        this.container.get("#settings-save-changes").on("click", () => this.handleSaveChanges());
        this.container.get("#account-change-password").on("click", () => this.handleChangePassword());
    }

    handleSaveChanges() {
        this.newPasswordField.style.display = "none";
        this.clearInputs();
        this.confirmationModal.open();
    }

    handleChangePassword() {
        this.newPasswordField.style.display = "block";
        this.clearInputs();
        this.newPasswordField.querySelector("input").focus();
        this.confirmationModal.open();
    }

    handleConfirm() {
        const patch = { password: this.confirmationModal.container.querySelector("input").value };
        const changedUsername = this.container.get("#settings-username").value;
        const changedEmail = this.container.get("#settings-email").value;
        const changedPassword = this.newPasswordField.querySelector("input").value;

        if (changedPassword) {
            if (this.container.get("#confirm-new-password").value !== changedPassword) {
                LS.Modal.buildEphemeral({
                    title: "Password mismatch",
                    content: "The new passwords do not match.",
                    buttons: [{ label: "Ok" }]
                });
                return;
            }
            patch.newPassword = changedPassword;
        }

        if (changedUsername && website.userFragment.username !== changedUsername) {
            patch.username = changedUsername;
        }

        if (changedEmail && website.userFragment.email !== changedEmail) {
            patch.email = changedEmail;
        }

        this.confirmationModal.close();

        this.auth.patch(patch, (error) => {
            if (error) {
                LS.Modal.buildEphemeral({
                    title: "Update failed",
                    content: error.error || error.message || "Sorry, an error occurred while updating your account. Please try again later.",
                    buttons: [{ label: "Ok" }]
                });
                return;
            }

            LS.Toast.show("Account updated successfully!", { timeout: 3000 });
        });

        this.clearInputs();
    }

    clearInputs() {
        this.confirmationModal.container.querySelectorAll("input").forEach(input => input.value = "");
    }
}


/**
 * Handles developer applications management
 */
class ApplicationsHandler {
    constructor(parent, developerAppEditor, tabs) {
        this.parent = parent;
        this.container = parent.container;
        this.developerAppEditor = developerAppEditor;
        this.tabs = tabs;
    }

    init() {
        this.parent.panelContent.querySelector(".create-app-button").addEventListener("click", () => {
            this.tabs.set("applications/create");
        });

        this.developerAppEditor.update();
        this.setupForm();
    }

    setupForm() {
        this.parent.panelContent.querySelector('#app-setup-form').appendChild(LS.Create("form", {
            id: "app-setup-form",
            onsubmit: () => false,
            inner: [
                { style: "display: flex; overflow: auto; flex-direction: column; gap: 32px; padding-bottom: 80px", inner: [
                    { tag: "h1", inner: "Create an application!", style: "margin: 0" },
                    { tag: "input", class: "clear", type: "text", id: "app-name", placeholder: "Project name", "aria-label": "Project name" },
                    { inner: [
                        { tag: "label", for: "app-description", inner: [ "Description ", LS.Create("ls-box", { class: "inline text-tag", inner: "Optional" }), LS.Create("i", { class: "bi-markdown-fill", "ls-tooltip": "Supports markdown" }) ] },
                        { tag: "br" },
                        { tag: "textarea", style: "height: 150px; resize: none; margin-top: 10px", id: "app-description", placeholder: "Enter a brief description of your application" },
                        { tag: "br" }
                    ] },
                    { inner: [
                        { tag: "label", for: "app-type", inner: [ "Primary purpose ", LS.Create("ls-box", { class: "inline text-tag", inner: "Optional" }) ] },
                        { tag: "br" },
                        LS.Create('ls-select', {
                            id: "app-type",
                            style: { marginTop: '10px' },
                            class: "elevated pill",
                            value: "other",
                            options: this.getCategoryOptions()
                        })
                    ] }
                ] }
            ]
        }));

        this.container.querySelector("#app-setup-form").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });
    }

    getCategoryOptions() {
        return [
            { icon: APP_CATEGORY_ICONS.web, value: "web", text: "Web Application" },
            { icon: APP_CATEGORY_ICONS.widget, value: "widget", text: "lstv.space Widget" },
            { icon: APP_CATEGORY_ICONS.software, value: "software", text: "Mobile/Desktop Application" },
            { icon: APP_CATEGORY_ICONS.mobile, value: "mobile", text: "Mobile Application" },
            { icon: APP_CATEGORY_ICONS.game, value: "game", text: "Game" },
            { icon: APP_CATEGORY_ICONS.bot, value: "bot", text: "Bot" },
            { icon: APP_CATEGORY_ICONS.api, value: "api", text: "API Service" },
            { icon: APP_CATEGORY_ICONS.other, value: "other", text: "Other" }
        ];
    }

    handleFormSubmit() {
        const form = document.forms['app-setup-form'];
        const payload = {
            name: String(form['app-name'].value).trim(),
            category: String(this.container.get('#app-type').value).trim(),
            description: String(form['app-description'].value).trim(),
            slug: ""
        };

        website.fetch("v1/apps/create", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }
        }, (error) => {
            if (error) {
                LS.Modal.buildEphemeral({
                    title: "App creation failed",
                    content: error.error || error.message || "Sorry, an error occurred while creating your app. Please try again later.",
                    buttons: [{ label: "Ok" }]
                });
            }
        });
    }
}