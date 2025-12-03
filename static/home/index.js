website.register(document.currentScript, function(context, container) {
    const auth = context.requestPermission(["auth"]).auth;

    context.setOptions({
        // title: "User Settings",
        dynamicAccount: true,
        path: "/home"
    });

    context.on("resume", () => {
        
    });

    context.on("suspend", () => {

    });

    context.on("destroy", () => {
        tabs.destroy();
    });

    const panel = container.get('.container');
    const panelContent = container.get(".settings-container");
    const loginNotice = LS.Create('div', { inner: [N("h3", "You are not logged in"), N("button", {
        textContent: "Log in",
        class: "pill",
        onclick() {
            website.showLoginToolbar();
        }
    })], class: "login-notice container-content" });

    website.watchUser((loggedIn, userFragment) => {
        if(!loggedIn) {
            panelContent.remove();
            panel.append(loginNotice);
            return;
        } else {
            panelContent.style.display = "";
            loginNotice.remove();
            panel.append(panelContent);
        }
    });

    context.registerSPAExtension("/home/", (page) => {
        panel.classList.remove('sidebar-menu-visible');
        tabs.set(page || "home");
    });

    const initial_page = location.pathname.split("/").slice(2)[0] || "home";
    const tabs = new LS.Tabs(container.querySelector('.sidebar-content'), {
        list: false
    });

    const siteScriptsOnce = new Set();
    const siteScripts = {
        profile() {
            const confirmButtons = container.get('.profile-editor-confirm-buttons');
            let editingUser = LS.Reactive.fork("editingUser", website.userFragment);

            website.watchUser((loggedIn, userFragment) => {
                if(loggedIn) {
                    editingUser.__reset(); // Reset the reactive user data
                }
            });

            editingUser.__binding.on("mutated", () => {
                confirmButtons.classList.add("visible");
            });

            editingUser.__binding.on("reset", () => {
                updateTextAreaLength();
            });

            window.addEventListener('beforeunload', function(e) {
                if(!confirmButtons.classList.contains("visible")) return;

                e.preventDefault();
                e.returnValue = '';
            });

            const _profile_about_length = container.get('#profile-about-length');
            const _profile_about = container.get("#profile-about");
            function updateTextAreaLength() {
                _profile_about_length && (_profile_about_length.textContent = `${_profile_about.value.length}/500`);
            }

            container.get("#profile-avatar").on("change", function() {
                const file = this.files[0];

                if (file) {
                    openCropper(file, {
                        width: 256,
                        height: 256,
                        shape: "circle",
                        field: "pfp",
                        animated: true
                    });
                }

                this.value = "";
            });

            container.get("#profile-remove-avatar").on("click", function() {
                editingUser.pfp = null;
            });

            container.get("#profile-banner").on("change", function() {
                const file = this.files[0];

                const fullscreenBanner = container.get(".profile-editor-container .profile").classList.contains("fullscreen-banner");

                const width = fullscreenBanner ? 170 : 340;
                const height = fullscreenBanner ? 240 : 160;

                if (file) {
                    openCropper(file, {
                        width,
                        height,
                        finalWidth: width * 2,
                        finalHeight: height * 2,
                        field: "banner",
                        animated: true
                    });
                }

                this.value = "";
            });

            container.get("#profile-remove-banner").on("click", function() {
                editingUser.banner = null;
            });

            container.get("#profile-displayname").on("input", function() {
                editingUser.displayname = this.value;
            });

            container.get("#profile-about").on("input", function() {
                editingUser.bio = this.value;
                updateTextAreaLength();
            });

            container.get("#profile-save").on("click", function() {
                saveProfile();
            });

            container.get("#profile-reset").on("click", function() {
                resetProfile();
            });

            container.get("#mature-content").on("change", function() {
                editingUser.mature_content = this.checked;
            });

            container.get("#fullscreen-banner").on("change", function() {
                editingUser.fullscreen_banner = this.checked;
            });

            container.get("#secret-glossy-style").on("change", function() {
                editingUser.profile_style = this.checked ? "glossy" : null;
            });

            const links_table = container.get("#links");
            for(const link of website.userFragment.external_links || []) {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${link.platform}</td>
                    <td><input type="text" name="link-${link.platform}" value="${link.url}" /></td>
                `;
                links_table.appendChild(row);
            }

            const blobs = {};

            function openCropper(file, options) {
                if(!LS.ImageCropper) {
                    console.error("ImageCropper module not loaded (yet).");
                    return;
                }

                const cropper = new LS.ImageCropper(file, {
                    ...options,
                    createURL: true,

                    async onResult(result) {
                        modal.close();
                        blobs[options.field] = result;
                        editingUser[`__animated_${options.field}`] = result.animated;
                        editingUser[options.field] = blobs[options.field].url;
                    },

                    onError(){
                        LS.Modal.buildEphemeral({
                            title: "Crop failed",
                            content: "Sorry, an error occurred while cropping or loading your image. Please try again later.",
                            buttons: [
                                { label: "Ok" }
                            ]
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
                            onClick() {
                                cropper.crop();
                            }
                        }
                    ]
                }, { canClickAway: false });

                modal.on("close", function() {
                    setTimeout(() => {
                        cropper.destroy();
                    }, 1000);
                });
            }

            async function saveProfile() {
                confirmButtons.getAll("button").forEach(button => {
                    button.attrAssign("disabled");
                });

                if (blobs.pfp || blobs.banner) {
                    // First, we need to upload the cropped image to the CDN file bucket. The API allows us to upload both at once.
                    try {
                        const formData = new FormData();
                        if (blobs.pfp) formData.append("file", blobs.pfp.blob, "avatar." + (editingUser.__animated_pfp ? "webm" : "webp"));
                        if (blobs.banner) formData.append("file", blobs.banner.blob, "banner." + (editingUser.__animated_banner ? "webm" : "webp"));

                        const response = await fetch(website.cdn + "/upload?intent=avatar&origin_id=" + editingUser.id, {
                            method: "POST",
                            body: formData
                        });

                        if (!response.ok) {
                            throw new Error("Failed to upload media");
                        }

                        const result = await response.json();

                        if (result && result.length > 0) {
                            if (blobs.pfp) blobs.pfp.uploadResult = result.find(file => file.originalName.startsWith("avatar"));
                            if (blobs.banner) blobs.banner.uploadResult = result.find(file => file.originalName.startsWith("banner"));
                        }
                    } catch (error) {
                        console.error("Error uploading media:", error);

                        LS.Modal.buildEphemeral({
                            title: "Upload failed",
                            content: "Sorry, an error occurred while uploading your media. Please try again later. If this persists, please contact us.",
                            buttons: [
                                { label: "Ok" }
                            ]
                        });

                        confirmButtons.getAll("button").forEach(button => {
                            button.removeAttribute("disabled");
                        });
                        return;
                    }
                }

                // Now we can patch the user profile with the new image hash
                const patch = editingUser.__data;

                if (blobs.pfp && blobs.pfp.uploadResult) {
                    patch.pfp = blobs.pfp.uploadResult.name;
                }

                if (blobs.banner && blobs.banner.uploadResult) {
                    patch.banner = blobs.banner.uploadResult.name;
                }

                auth.patch(patch, (error, response) => {
                    confirmButtons.getAll("button").forEach(button => {
                        button.removeAttribute("disabled");
                    });

                    if (error) {
                        LS.Modal.buildEphemeral({
                            title: "Update failed",
                            content: error.error || error.message || "Sorry, an error occurred while updating your profile. Please try again later. If this persists, please contact us.",
                            buttons: [
                                { label: "Ok" }
                            ]
                        });
                        return;
                    }

                    confirmButtons.classList.remove("visible");

                    // Reset the blobs after successful update
                    if (blobs.pfp) {
                        URL.revokeObjectURL(blobs.pfp.url);
                        blobs.pfp = null;
                    }

                    if (blobs.banner) {
                        URL.revokeObjectURL(blobs.banner.url);
                        blobs.banner = null;
                    }

                    LS.Toast.show("Profile updated successfully!", { timeout: 3000 });
                    editingUser.__reset();
                });
            }

            function resetProfile() {
                editingUser.__reset();
                blobs.pfp = null;
                blobs.banner = null;
                confirmButtons.classList.remove("visible");
            }
        },

        account() {
            const newPasswordField = N([
                N("label", { textContent: "New password:", attr: { for: "new-password" } }),
                N("input", { type: "password", id: "new-password", attr: { autocomplete: "new-password" } }),
                N("label", { textContent: "Confirm new password:", attr: { for: "confirm-new-password" } }),
                N("input", { type: "password", id: "confirm-new-password", attr: { autocomplete: "new-password" } })
            ]);

            function clearInputs(){
                confirmationModal.container.querySelectorAll("input").forEach(input => input.value = "");
            }

            const confirmationModal = LS.Modal.build({
                title: "Confirm Changes",
                content: [
                    N("label", { textContent: "Current password:", attr: { for: "current-password" } }),
                    N("input", { type: "password", id: "current-password", attr: { autocomplete: "current-password" } }),
                    newPasswordField
                ],
                buttons: [
                    {
                        label: "Cancel",
                        class: "elevated"
                    },
                    {
                        label: "Confirm",
                        onClick() {
                            const patch = { password: confirmationModal.container.querySelector("input").value };
                            const changedUsername = container.get("#settings-username").value;
                            const changedEmail = container.get("#settings-email").value;
                            const changedPassword = newPasswordField.querySelector("input").value;

                            if (changedPassword) {
                                if(container.get("#confirm-new-password").value !== changedPassword) {
                                    LS.Modal.buildEphemeral({
                                        title: "Password mismatch",
                                        content: "The new passwords do not match.",
                                        buttons: [
                                            { label: "Ok" }
                                        ]
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

                            confirmationModal.close();

                            auth.patch(patch, (error, response) => {
                                if (error) {
                                    LS.Modal.buildEphemeral({
                                        title: "Update failed",
                                        content: error.error || error.message || "Sorry, an error occurred while updating your account. Please try again later. If this persists, please contact us.",
                                        buttons: [
                                            { label: "Ok" }
                                        ]
                                    });
                                    return;
                                }

                                LS.Toast.show("Account updated successfully!", { timeout: 3000 });
                            });

                            clearInputs();
                        }
                    }
                ]
            });

            container.get("#settings-save-changes").on("click", function() {
                newPasswordField.style.display = "none";
                clearInputs();
                confirmationModal.open();
            });

            container.get("#account-change-password").on("click", function() {
                newPasswordField.style.display = "block";
                clearInputs();
                newPasswordField.querySelector("input").focus();
                confirmationModal.open();
            });
        },

        dev() {
            website.fetch("v1/apps/list", {}, (error, response) => {
                if (error) {
                    console.error("Failed to fetch app list:", error);
                    return;
                }

                const listElement = container.get("#dev-apps-list");
                listElement.innerHTML = "";

                for(let app of response) {
                    const appElement = N("div", {
                        class: "dev-app-entry",
                        inner: []
                    });

                    listElement.add(appElement);
                }

                tabs.set("app-setup");
            });

            container.get("#app-setup-form").on("submit", function() {
                const form = document.forms['app-setup-form'];
                const payload = {
                    name: String(form['app-name'].value).trim(),
                    description: String(form['app-description'].value).trim(),
                    slug: "",
                }
                website.fetch("v1/apps/create", {
                    method: "POST",
                    body: {}
                }, (error, response) => {
                    if (error) {
                        LS.Modal.buildEphemeral({
                            title: "App creation failed",
                            content: error.error || error.message || "Sorry, an error occurred while creating your app. Please try again later. If this persists, please contact us.",
                            buttons: [
                                { label: "Ok" }
                            ]
                        });
                        return;
                    }
                });
                return false;
            });
        }
    }

    tabs.on("changed", function(tab, old) {
        const view = tabs.currentElement();
        const oldElement = tabs.tabs.get(old)?.element;

        if(!siteScriptsOnce.has(tab) && siteScripts[tab]) {
            siteScripts[tab]?.();
            siteScriptsOnce.add(tab);
        }

        LS.Animation.slideInToggle(view, oldElement);
        container.get('.title').textContent = view.getAttribute("tab-title") || "User Settings";

        const button = container.get(`[data-tab-id="${tab}"]`);
        const activeButton = container.get(`.menu .active`);
        if (activeButton) {
            activeButton.classList.remove('active');
            activeButton.classList.remove('level-1');
        }

        if (button) {
            button.classList.add('active');
            button.classList.add('level-1');
        }
    });

    tabs.set(initial_page);
});