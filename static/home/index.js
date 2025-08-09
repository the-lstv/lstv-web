app.module('home', function(app, page, container) {
    page.title = "User Settings";

    page.registerSPAExtension("/home/", (page) => {
        container.get('.container').classList.remove('sidebar-menu-visible');
        tabs.set(page || "home");
    });

    const initial_page = location.pathname.split("/").slice(2)[0] || "home";
    const tabs = new LS.Tabs(container.querySelector('.sidebar-content'), {
        list: false
    });

    const siteScriptsOnce = [];
    const siteScripts = {
        profile() {
            const editingUser = LS.Reactive.fork("editingUser", app.userFragment);
            const confirmButtons = container.get('.profile-editor-confirm-buttons');

            app.once("user-loaded", () => {
                editingUser.__reset(); // Reset the reactive user data
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

            function updateTextAreaLength() {
                container.get('#profile-about-length').textContent = `${O("#profile-about").value.length}/500`;
            }

            O("#profile-avatar").on("change", function() {
                const file = this.files[0];

                if (file) {
                    openCropper(file, {
                        width: 256,
                        height: 256,
                        shape: "circle",
                        field: "pfp"
                    });
                }

                this.value = "";
            });

            O("#profile-remove-avatar").on("click", function() {
                editingUser.pfp = null;
            });

            O("#profile-banner").on("change", function() {
                const file = this.files[0];

                if (file) {
                    openCropper(file, {
                        width: 340,
                        height: 160,
                        finalWidth: 340 * 2,
                        finalHeight: 160 * 2,
                        field: "banner"
                    });
                }

                this.value = "";
            });

            O("#profile-remove-banner").on("click", function() {
                editingUser.banner = null;
            });

            O("#profile-displayname").on("input", function() {
                editingUser.displayname = this.value;
            });

            O("#profile-about").on("input", function() {
                editingUser.bio = this.value;
                updateTextAreaLength();
            });

            O("#profile-save").on("click", function() {
                saveProfile();
            });

            O("#profile-reset").on("click", function() {
                resetProfile();
            });

            O("#add-link").on("click", function() {
                
            });

            // O("#profile-remove-links").on("click", function() {
            //     editingUser.external_links = [];
            // });

            O("#mature-content").on("change", function() {
                editingUser.nsfw = this.checked;
            });

            const links_table = O("#links");
            for(const link of app.userFragment.external_links || []) {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${link.platform}</td>
                    <td><input type="text" name="link-${link.platform}" value="${link.url}" /></td>
                `;
                links_table.appendChild(row);
            }

            const blobs = {};

            function openCropper(file, options) {
                const cropper = new LS.ImageCropper(file, {
                    ...options,

                    async onResult(blob) {
                        blobs[options.field] = { blob, url: URL.createObjectURL(blob) };
                        editingUser[options.field] = blobs[options.field].url;
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
                                modal.close();
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
                        if (blobs.pfp) formData.append("file", blobs.pfp.blob, "avatar.png");
                        if (blobs.banner) formData.append("file", blobs.banner.blob, "banner.png");

                        const response = await fetch(app.cdn + "/upload", {
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

                app.auth.patch(patch, (error, response) => {
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
                            const changedUsername = O("#settings-username").value;
                            const changedEmail = O("#settings-email").value;
                            const changedPassword = newPasswordField.querySelector("input").value;

                            if (changedPassword) {
                                if(O("#confirm-new-password").value !== changedPassword) {
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

                            if (changedUsername && app.userFragment.username !== changedUsername) {
                                patch.username = changedUsername;
                            }

                            if (changedEmail && app.userFragment.email !== changedEmail) {
                                patch.email = changedEmail;
                            }

                            confirmationModal.close();

                            app.auth.patch(patch, (error, response) => {
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

            O("#settings-save-changes").on("click", function() {
                newPasswordField.style.display = "none";
                clearInputs();
                confirmationModal.open();
            });

            O("#account-change-password").on("click", function() {
                newPasswordField.style.display = "block";
                clearInputs();
                newPasswordField.querySelector("input").focus();
                confirmationModal.open();
            });
        }
    }

    tabs.on("changed", function(tab, old) {
        const view = tabs.currentElement();
        const oldElement = tabs.tabs.get(old)?.element;

        if(!siteScriptsOnce.includes(tab) && siteScripts[tab]) {
            siteScripts[tab]?.();
            siteScriptsOnce.push(tab);
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